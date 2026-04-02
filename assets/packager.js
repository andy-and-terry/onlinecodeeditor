/**
 * packager.js – Client-side ZIP packager.
 *
 * Packages the current project files into a downloadable ZIP that can be
 * run locally (open index.html in a browser).
 *
 * Supported files
 * ───────────────
 *   .html / .js / .css / .txt / .vbs / custom text extensions
 *     → Included as-is.  If no index.html exists, a minimal launcher is
 *       generated so the ZIP is immediately "runnable".
 *
 *   .sb3
 *     → Included as a raw binary file (stored as-is in the ZIP).
 *       A README_SB3.txt placeholder is added explaining that full
 *       TurboWarp packaging requires a follow-up step.
 *
 * Usage (ES module):
 *   import { packageProject } from './packager.js';
 *   await packageProject(files);   // files: Map<name, {content, type}>
 */


const SB3_NOTE = `SB3 Packaging – Placeholder
===========================

The file(s) listed below are Scratch / TurboWarp project files (.sb3).
They have been included in this ZIP as raw binary data.

To produce a fully self-contained, runnable HTML from a .sb3 file you need
one of the following (future integration steps):

  Option A – TurboWarp Packager web app
    Visit https://packager.turbowarp.org/, upload your .sb3, and
    download the packaged HTML or ZIP.

  Option B – Self-hosted TurboWarp Packager API
    Integrate @turbowarp/packager (npm) into a Node.js build step
    and call it programmatically.

  Option C – postMessage integration (editor roadmap)
    When the block editor is wired up via postMessage, the editor
    will be able to request an export from TurboWarp and forward the
    result to this packager automatically.

`;

/**
 * Package project files into a ZIP and trigger a browser download.
 *
 * @param {Map<string, {content: string|Uint8Array, isBinary?: boolean}>} files
 *   Map of filename → file descriptor.
 * @param {string} [zipName='project.zip']
 */
async function packageProject(files, zipName = 'project.zip') {
  const zip = new ZipWriter();
  let hasSb3 = false;
  let hasIndex = false;
  const sb3Names = [];

  for (const [name, descriptor] of files) {
    const content = descriptor.content;
    const lower   = name.toLowerCase();

    if (lower === 'index.html') hasIndex = true;

    if (lower.endsWith('.sb3')) {
      hasSb3 = true;
      sb3Names.push(name);
      // Include raw binary (content should already be Uint8Array for binary files)
      const bytes = content instanceof Uint8Array
        ? content
        : new TextEncoder().encode(content);
      zip.addFile(name, bytes);
    } else if (content instanceof Uint8Array) {
      zip.addFile(name, content);
    } else {
      zip.addFile(name, String(content));
    }
  }

  // If no index.html, generate a minimal launcher listing all files.
  if (!hasIndex) {
    zip.addFile('index.html', generateLauncher([...files.keys()]));
  }

  // Add .sb3 placeholder note if needed.
  if (hasSb3) {
    zip.addFile(
      'README_SB3.txt',
      SB3_NOTE + 'Included .sb3 file(s):\n' + sb3Names.map(n => `  - ${n}`).join('\n') + '\n',
    );
  }

  zip.download(zipName);
}

// ── Internal ───────────────────────────────────────────────────────────────

/**
 * Generate a minimal index.html that lists the project files.
 * @param {string[]} names
 * @returns {string}
 */
function generateLauncher(names) {
  const items = names.map(n => `<li><a href="${escHtml(n)}">${escHtml(n)}</a></li>`).join('\n    ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Packaged Project</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 16px; }
  </style>
</head>
<body>
  <h1>Packaged Project</h1>
  <p>This ZIP was exported from the Mini Scratch editor. Open one of the files below:</p>
  <ul>
    ${items}
  </ul>
</body>
</html>`;
}

/** @param {string} str @returns {string} */
function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
