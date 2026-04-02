/**
 * app.js – Mini Scratch editor main entry point.
 *
 * Features
 * ────────
 *  • Tabbed file editor (create / rename / delete)
 *  • Text editor for .html .js .vbs .css .txt and any custom extension
 *  • Blocks (TurboWarp iframe) view for .sb3 files
 *  • Live HTML preview pane
 *  • Console pane
 *  • Files list pane
 *  • Upload (multi-file) and per-file download
 *  • ZIP packager (via packager.js / jszip-mini.js)
 *  • Translation: JS↔HTML, Blocks↔JS, with unsupported-path modal
 *  • LocalStorage persistence
 */

import { packageProject } from './packager.js';
import { translate }       from './translate.js';

// ── Storage key ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'miniScratch.project.v1';
/** Delay in ms before revoking an object URL after triggering a download. */
const URL_REVOKE_DELAY_MS = 10_000;
/** Debounce delay (ms) for persisting edits to localStorage. */
const SAVE_DEBOUNCE_MS = 1_000;
/** Debounce delay (ms) for refreshing the HTML preview while typing. */
const PREVIEW_DEBOUNCE_MS = 500;
/** Maximum file size (bytes) accepted via the upload button. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// ── State ─────────────────────────────────────────────────────────────────
/** @type {Map<string, { content: string, isBinary?: boolean }>} */
let files       = new Map();
let activeFile  = null;
/** Pending rename target (while modal is open). */
let renameTarget = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let _saveTimer    = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let _previewTimer = null;

// ── Boot ──────────────────────────────────────────────────────────────────
loadFromStorage();
if (files.size === 0) {
  addFile('index.html', DEFAULT_HTML);
  addFile('app.js',     DEFAULT_JS);
}
renderTabs();
renderFilesList();
if (!activeFile) setActive(files.keys().next().value);

// ── DOM refs ──────────────────────────────────────────────────────────────
const $textEditor     = /** @type {HTMLTextAreaElement} */ (q('#textEditor'));
const $blocksArea     = q('#blocksArea');
const $tabs           = q('#tabs');
const $htmlPreview    = /** @type {HTMLIFrameElement}   */ (q('#htmlPreview'));
const $consoleOut     = q('#consoleOut');
const $filesList      = q('#filesList');
const $fileInput      = /** @type {HTMLInputElement}    */ (q('#fileInput'));
const $sb3Input       = /** @type {HTMLInputElement}    */ (q('#sb3Input'));
const $turbowarpFrame = /** @type {HTMLIFrameElement}   */ (q('#turbowarpFrame'));

// ── Topbar buttons ────────────────────────────────────────────────────────
q('#btnNewFile').addEventListener('click', () => openModal('modalNewFile'));

q('#btnUpload').addEventListener('click', () => $fileInput.click());
$fileInput.addEventListener('change', handleUpload);

q('#btnDownloadZip').addEventListener('click', handlePackageZip);

q('#btnTranslate').addEventListener('click', handleTranslate);

q('#btnOpenSb3').addEventListener('click', () => $sb3Input.click());
$sb3Input.addEventListener('change', handleOpenSb3);

q('#btnExportSb3').addEventListener('click', handleExportSb3);

// ── Right pane tabs ───────────────────────────────────────────────────────
q('.rightTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.rtab');
  if (!btn) return;
  const view = btn.dataset.view;
  qAll('.rtab').forEach(b => {
    b.classList.toggle('active', b === btn);
    b.setAttribute('aria-selected', String(b === btn));
  });
  qAll('.view').forEach(v => {
    const active = v.id === `view${capitalize(view)}`;
    v.classList.toggle('active', active);
    v.classList.toggle('hidden', !active);
  });
});

// ── New file modal ────────────────────────────────────────────────────────
q('#confirmNewFile').addEventListener('click', () => {
  const input = /** @type {HTMLInputElement} */ (q('#newFileName'));
  const name  = input.value.trim();
  if (!name) { input.focus(); return; }
  if (files.has(name)) {
    consoleLog(`⚠ File "${name}" already exists.`);
    closeModal('modalNewFile');
    setActive(name);
    return;
  }
  addFile(name, '');
  renderTabs();
  renderFilesList();
  setActive(name);
  saveToStorage();
  input.value = '';
  closeModal('modalNewFile');
});
q('#cancelNewFile').addEventListener('click', () => {
  q('#newFileName').value = '';
  closeModal('modalNewFile');
});
q('#newFileName').addEventListener('keydown', e => e.key === 'Enter' && q('#confirmNewFile').click());

// ── Rename modal ──────────────────────────────────────────────────────────
q('#confirmRename').addEventListener('click', () => {
  const input   = /** @type {HTMLInputElement} */ (q('#renameInput'));
  const newName = input.value.trim();
  if (!newName || !renameTarget) { input.focus(); return; }
  if (newName !== renameTarget && files.has(newName)) {
    consoleLog(`⚠ A file named "${newName}" already exists.`);
    return;
  }
  renameFile(renameTarget, newName);
  renameTarget = null;
  closeModal('modalRename');
});
q('#cancelRename').addEventListener('click', () => {
  renameTarget = null;
  closeModal('modalRename');
});
q('#renameInput').addEventListener('keydown', e => e.key === 'Enter' && q('#confirmRename').click());

// ── Translation modal ─────────────────────────────────────────────────────
q('#confirmDeleteCode').addEventListener('click', () => {
  applyTranslation('', activeFile, q('#translateTo').value);
  closeModal('modalTranslateError');
});
q('#cancelTranslate').addEventListener('click', () => closeModal('modalTranslateError'));

// ── Alert modal ───────────────────────────────────────────────────────────
q('#confirmAlert').addEventListener('click', () => closeModal('modalAlert'));

// ── Clear console ─────────────────────────────────────────────────────────
q('#btnClearConsole').addEventListener('click', () => { $consoleOut.textContent = ''; });

// ── textarea input ────────────────────────────────────────────────────────
$textEditor.addEventListener('input', () => {
  if (!activeFile) return;
  const fd = files.get(activeFile);
  if (fd) {
    fd.content = $textEditor.value;
    // Debounce persistence – avoid a full JSON serialise on every keystroke.
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(saveToStorage, SAVE_DEBOUNCE_MS);
    // Debounce preview – avoid forcing a full iframe reload on every keystroke.
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(refreshPreview, PREVIEW_DEBOUNCE_MS);
  }
});

// Handle tab key in editor
$textEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = $textEditor.selectionStart;
    const end   = $textEditor.selectionEnd;
    $textEditor.value = $textEditor.value.substring(0, start) + '  ' + $textEditor.value.substring(end);
    $textEditor.selectionStart = $textEditor.selectionEnd = start + 2;
    // Trigger input to save
    $textEditor.dispatchEvent(new Event('input'));
  }
});

// ── Functions ─────────────────────────────────────────────────────────────

/** @param {string} name @param {string} content */
function addFile(name, content, isBinary = false) {
  files.set(name, { content, isBinary });
}

/** @param {string} name */
function setActive(name) {
  if (!files.has(name)) return;
  // Flush any pending debounced save and persist current editor content.
  if (activeFile && files.has(activeFile)) {
    const prev = files.get(activeFile);
    if (!prev.isBinary && prev.content !== $textEditor.value) {
      prev.content = $textEditor.value;
      clearTimeout(_saveTimer);
      saveToStorage();
    }
  }
  activeFile = name;

  const fd     = files.get(name);
  const isBlocks = name.toLowerCase().endsWith('.sb3');

  $textEditor.classList.toggle('hidden', isBlocks);
  $blocksArea.classList.toggle('hidden', !isBlocks);

  if (!isBlocks) {
    $textEditor.value = fd.content;
    $textEditor.focus();
  }

  renderTabs();
  refreshPreview();
}

/** @param {string} oldName @param {string} newName */
function renameFile(oldName, newName) {
  const fd = files.get(oldName);
  if (!fd) return;
  // Rebuild map to preserve insertion order
  const newMap = new Map();
  for (const [k, v] of files) {
    newMap.set(k === oldName ? newName : k, v);
  }
  files = newMap;
  if (activeFile === oldName) activeFile = newName;
  renderTabs();
  renderFilesList();
  saveToStorage();
}

/** @param {string} name */
function deleteFile(name) {
  files.delete(name);
  if (activeFile === name) {
    activeFile = null;
    const next = files.keys().next().value;
    if (next) setActive(next);
    else {
      $textEditor.value = '';
      $blocksArea.classList.add('hidden');
      $textEditor.classList.remove('hidden');
    }
  }
  renderTabs();
  renderFilesList();
  saveToStorage();
}

/** Download a single file. @param {string} name */
function downloadFile(name) {
  const fd = files.get(name);
  if (!fd) return;
  const content = fd.content instanceof Uint8Array ? fd.content : new TextEncoder().encode(fd.content);
  const blob = new Blob([content]);
  triggerDownload(blob, name);
}

function renderTabs() {
  $tabs.innerHTML = '';
  for (const name of files.keys()) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (name === activeFile ? ' active' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(name === activeFile));

    const nameBtn = document.createElement('button');
    nameBtn.className  = 'tab-name';
    nameBtn.textContent = name;
    nameBtn.title = `Switch to ${name}`;
    nameBtn.addEventListener('click', () => {
      if (name === activeFile) {
        openRenameModal(name);
      } else {
        setActive(name);
      }
    });
    nameBtn.addEventListener('dblclick', () => openRenameModal(name));

    const closeBtn = document.createElement('button');
    closeBtn.className  = 'x';
    closeBtn.title      = `Close ${name}`;
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', `Close ${name}`);
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteFile(name); });

    tab.appendChild(nameBtn);
    tab.appendChild(closeBtn);
    $tabs.appendChild(tab);
  }
}

function renderFilesList() {
  $filesList.innerHTML = '';
  for (const name of files.keys()) {
    const entry = document.createElement('div');
    entry.className = 'file-entry';

    const nameBtn = document.createElement('button');
    nameBtn.className   = 'file-entry__name';
    nameBtn.textContent = name;
    nameBtn.title = `Open ${name}`;
    nameBtn.addEventListener('click', () => setActive(name));

    const actions = document.createElement('div');
    actions.className = 'file-entry__actions';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = '✏️';
    renameBtn.title = 'Rename';
    renameBtn.addEventListener('click', () => openRenameModal(name));

    const dlBtn = document.createElement('button');
    dlBtn.textContent = '⬇️';
    dlBtn.title = 'Download';
    dlBtn.addEventListener('click', () => downloadFile(name));

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', () => deleteFile(name));

    actions.appendChild(renameBtn);
    actions.appendChild(dlBtn);
    actions.appendChild(delBtn);
    entry.appendChild(nameBtn);
    entry.appendChild(actions);
    $filesList.appendChild(entry);
  }
}

function refreshPreview() {
  if (!activeFile) return;
  const lower = activeFile.toLowerCase();
  if (!lower.endsWith('.html') && lower !== 'index.html') return;
  const fd = files.get(activeFile);
  if (!fd) return;
  $htmlPreview.srcdoc = fd.content;
}

/** @param {string} name */
function openRenameModal(name) {
  renameTarget = name;
  const input = /** @type {HTMLInputElement} */ (q('#renameInput'));
  input.value = name;
  openModal('modalRename');
  setTimeout(() => { input.select(); }, 60);
}

// ── Upload ─────────────────────────────────────────────────────────────────

async function handleUpload(e) {
  const inputEl = /** @type {HTMLInputElement} */ (e.target);
  const fileList = inputEl.files;
  if (!fileList || fileList.length === 0) return;

  for (const file of fileList) {
    if (file.size > MAX_UPLOAD_BYTES) {
      consoleLog(`⚠ Skipped "${file.name}": file exceeds the 10 MB limit.`);
      continue;
    }
    const isBinary = isBinaryExtension(file.name);
    if (isBinary) {
      const buf   = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      addFile(file.name, bytes, true);
    } else {
      const text = await file.text();
      addFile(file.name, text);
    }
    consoleLog(`Uploaded: ${file.name}`);
  }
  renderTabs();
  renderFilesList();
  saveToStorage();
  // Switch to the last uploaded file
  const last = fileList[fileList.length - 1].name;
  setActive(last);
  inputEl.value = '';
}

async function handleOpenSb3(e) {
  const inputEl = /** @type {HTMLInputElement} */ (e.target);
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;

  const buf   = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  addFile(file.name, bytes, true);
  consoleLog(`Opened .sb3: ${file.name}`);
  renderTabs();
  renderFilesList();
  saveToStorage();
  setActive(file.name);
  inputEl.value = '';

  // Attempt to post to TurboWarp iframe (placeholder).
  $turbowarpFrame.contentWindow?.postMessage({ type: 'tw-open-sb3', buffer: buf }, '*');
}

function handleExportSb3() {
  // Request export from TurboWarp iframe (placeholder).
  $turbowarpFrame.contentWindow?.postMessage({ type: 'tw-export-sb3' }, '*');
  showAlert(
    'Export .sb3',
    'The export request has been sent to the TurboWarp frame. ' +
    'Full export wiring requires self-hosting TurboWarp (see turbowarp-embed.html for notes).',
  );
}

// ── ZIP packager ───────────────────────────────────────────────────────────

async function handlePackageZip() {
  if (files.size === 0) {
    showAlert('Package ZIP', 'No files to package. Create or upload some files first.');
    return;
  }
  consoleLog('Packaging ZIP…');
  try {
    await packageProject(files, 'project.zip');
    consoleLog('✓ ZIP downloaded.');
  } catch (err) {
    consoleLog(`✗ Packaging failed: ${err.message}`);
    showAlert('Packaging Error', err.message);
  }
}

// ── Translation ────────────────────────────────────────────────────────────

function handleTranslate() {
  if (!activeFile) {
    showAlert('Translate', 'No active file. Open or create a file first.');
    return;
  }
  const from   = /** @type {HTMLSelectElement} */ (q('#translateFrom')).value;
  const to     = /** @type {HTMLSelectElement} */ (q('#translateTo')).value;
  const source = $textEditor.value;

  const result = translate(from, to, source);

  if (result.ok) {
    applyTranslation(result.output, activeFile, to);
  } else {
    q('#modalTranslateErrorMsg').textContent = result.error;
    openModal('modalTranslateError');
  }
}

/**
 * @param {string} newContent
 * @param {string} fileName
 * @param {string} toLang
 */
function applyTranslation(newContent, fileName, toLang) {
  // Optionally rename the active file to match the target extension.
  const extMap = { js: '.js', html: '.html', blocks: '.sb3', vbs: '.vbs', text: '.txt' };
  const newExt = extMap[toLang];
  let targetName = fileName;

  if (newExt) {
    const base = fileName.replace(/\.[^.]+$/, '');
    targetName = base + newExt;
  }

  if (targetName !== fileName) {
    renameFile(fileName, targetName);
  }

  const fd = files.get(targetName);
  if (fd) {
    fd.content = newContent;
    fd.isBinary = false;
  }

  $textEditor.value = newContent;
  setActive(targetName);
  saveToStorage();
  consoleLog(`✓ Translated to ${toLang}: ${targetName}`);
}

// ── Persistence ────────────────────────────────────────────────────────────

function saveToStorage() {
  try {
    const serialisable = [];
    for (const [name, fd] of files) {
      if (fd.isBinary || fd.content instanceof Uint8Array) {
        // Store binary as base64 using chunked approach to avoid stack overflow
        // on large files (spread operator has a call-stack size limit).
        const bytes = fd.content instanceof Uint8Array ? fd.content : new TextEncoder().encode(fd.content);
        const CHUNK = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        serialisable.push({ name, content: btoa(binary), isBinary: true });
      } else {
        serialisable.push({ name, content: fd.content, isBinary: false });
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ files: serialisable, active: activeFile }));
  } catch (e) {
    consoleLog('⚠ Could not save to localStorage: ' + e.message);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const entry of data.files || []) {
      if (entry.isBinary) {
        const binary = atob(entry.content);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        files.set(entry.name, { content: bytes, isBinary: true });
      } else {
        files.set(entry.name, { content: entry.content, isBinary: false });
      }
    }
    if (data.active && files.has(data.active)) activeFile = data.active;
  } catch (e) {
    // Corrupted storage – start fresh.
    files.clear();
    consoleLog('⚠ Could not load from localStorage: ' + e.message);
  }
}

// ── Modals ─────────────────────────────────────────────────────────────────

/** @param {string} id */
function openModal(id) {
  const el = q(`#${id}`);
  el.classList.remove('hidden');
  // Focus first input inside modal
  const inp = el.querySelector('input');
  if (inp) setTimeout(() => inp.focus(), 50);
}

/** @param {string} id */
function closeModal(id) {
  q(`#${id}`).classList.add('hidden');
}

/** @param {string} title @param {string} msg */
function showAlert(title, msg) {
  q('#modalAlertTitle').textContent = title;
  q('#modalAlertMsg').textContent   = msg;
  openModal('modalAlert');
}

// ── Console ────────────────────────────────────────────────────────────────

/** @param {string} msg */
function consoleLog(msg) {
  const line = `[${timestamp()}] ${msg}\n`;
  $consoleOut.textContent += line;
  $consoleOut.scrollTop = $consoleOut.scrollHeight;
}

function timestamp() {
  return new Date().toLocaleTimeString();
}

// ── Utilities ──────────────────────────────────────────────────────────────

/** @param {string} sel @returns {Element} */
function q(sel) { return document.querySelector(sel); }

/** @param {string} sel @returns {NodeListOf<Element>} */
function qAll(sel) { return document.querySelectorAll(sel); }

/** @param {string} s @returns {string} */
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** @param {Blob} blob @param {string} name */
function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
}

/** @param {string} filename @returns {boolean} */
function isBinaryExtension(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ['sb3', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'wav', 'mp3', 'ogg', 'mp4', 'zip'].includes(ext);
}

// ── Default file contents ─────────────────────────────────────────────────

const DEFAULT_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>My Project</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f4f8; }
    h1   { color: #1e3a5f; }
  </style>
</head>
<body>
  <h1>Hello from Mini Scratch! 👋</h1>
  <script src="app.js"><\/script>
</body>
</html>`;

const DEFAULT_JS = `// app.js – Edit me!
console.log('Hello from Mini Scratch!');
`;
