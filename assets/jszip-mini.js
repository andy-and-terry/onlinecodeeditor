/**
 * jszip-mini.js – Minimal, dependency-free in-browser ZIP creator.
 *
 * Supports:
 *   - Stored (compression method 0) entries only.
 *   - UTF-8 filenames and text content.
 *   - Binary content via Uint8Array.
 *
 * Usage:
 *   import { ZipWriter } from './jszip-mini.js';
 *   const zip = new ZipWriter();
 *   zip.addFile('hello.txt', 'Hello, world!');
 *   zip.addFile('data.bin', new Uint8Array([0,1,2]));
 *   const blob = zip.toBlob();          // application/zip
 *   const url  = URL.createObjectURL(blob);
 */

const SIGNATURE_LOCAL  = 0x04034b50;
const SIGNATURE_CDIR   = 0x02014b50;
const SIGNATURE_EOCD   = 0x06054b50;
const VERSION_NEEDED   = 20;
const VERSION_MADE_BY  = 20;
const METHOD_STORED    = 0;
/** Delay in ms before revoking an object URL after triggering a download. */
const URL_REVOKE_DELAY_MS = 10_000;

/** Simple CRC-32 table for ZIP checksums. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

/** @param {Uint8Array} data @returns {number} */
function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** @param {string} str @returns {Uint8Array} */
function encodeUtf8(str) {
  return new TextEncoder().encode(str);
}

/** Write a little-endian 16-bit value into a DataView. */
function u16(dv, offset, val) { dv.setUint16(offset, val, true); }
/** Write a little-endian 32-bit value into a DataView. */
function u32(dv, offset, val) { dv.setUint32(offset, val, true); }

/** Concatenate an array of Uint8Arrays into one. */
function concat(arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out   = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { out.set(a, pos); pos += a.length; }
  return out;
}

class ZipWriter {
  constructor() {
    /** @type {Array<{name: Uint8Array, data: Uint8Array, crc: number, offset: number}>} */
    this._entries = [];
    this._offset  = 0;
    this._parts   = [];
  }

  /**
   * Add a file to the ZIP.
   * @param {string} name  – file path inside the ZIP (use forward slashes)
   * @param {string|Uint8Array} content – text string or raw bytes
   */
  addFile(name, content) {
    const nameBytes = encodeUtf8(name);
    const data = typeof content === 'string' ? encodeUtf8(content) : content;
    const crc  = crc32(data);

    // Local file header (30 bytes + name)
    const header = new Uint8Array(30 + nameBytes.length);
    const dv     = new DataView(header.buffer);
    u32(dv,  0, SIGNATURE_LOCAL);
    u16(dv,  4, VERSION_NEEDED);
    u16(dv,  6, 0x0800); // UTF-8 flag
    u16(dv,  8, METHOD_STORED);
    u16(dv, 10, 0); // mod time
    u16(dv, 12, 0); // mod date
    u32(dv, 14, crc);
    u32(dv, 18, data.length);
    u32(dv, 22, data.length);
    u16(dv, 26, nameBytes.length);
    u16(dv, 28, 0); // extra length
    header.set(nameBytes, 30);

    this._entries.push({
      name:  nameBytes,
      data,
      crc,
      offset: this._offset,
    });
    this._parts.push(header, data);
    this._offset += header.length + data.length;
  }

  /**
   * Serialise the ZIP archive and return a Blob.
   * @returns {Blob}
   */
  toBlob() {
    const cdirParts = [];
    let cdirSize = 0;

    for (const entry of this._entries) {
      const rec = new Uint8Array(46 + entry.name.length);
      const dv  = new DataView(rec.buffer);
      u32(dv,  0, SIGNATURE_CDIR);
      u16(dv,  4, VERSION_MADE_BY);
      u16(dv,  6, VERSION_NEEDED);
      u16(dv,  8, 0x0800); // UTF-8 flag
      u16(dv, 10, METHOD_STORED);
      u16(dv, 12, 0); u16(dv, 14, 0); // time, date
      u32(dv, 16, entry.crc);
      u32(dv, 20, entry.data.length);
      u32(dv, 24, entry.data.length);
      u16(dv, 28, entry.name.length);
      u16(dv, 30, 0); // extra
      u16(dv, 32, 0); // comment
      u16(dv, 34, 0); // disk start
      u16(dv, 36, 0); // int attrs
      u32(dv, 38, 0); // ext attrs
      u32(dv, 42, entry.offset);
      rec.set(entry.name, 46);
      cdirParts.push(rec);
      cdirSize += rec.length;
    }

    const eocd = new Uint8Array(22);
    const dv   = new DataView(eocd.buffer);
    u32(dv,  0, SIGNATURE_EOCD);
    u16(dv,  4, 0); u16(dv, 6, 0); // disk numbers
    u16(dv,  8, this._entries.length);
    u16(dv, 10, this._entries.length);
    u32(dv, 12, cdirSize);
    u32(dv, 16, this._offset);
    u16(dv, 20, 0); // comment length

    const allParts = [...this._parts, ...cdirParts, eocd];
    return new Blob([concat(allParts)], { type: 'application/zip' });
  }

  /**
   * Trigger a browser download of the ZIP.
   * @param {string} filename
   */
  download(filename) {
    const blob = this.toBlob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    // Revoke the object URL after a short delay to allow the download to start.
    setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
  }
}
