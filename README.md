# Mini Scratch – Online Code Editor

A browser-based code editor that speaks HTML, JavaScript, VBScript, custom file extensions, and Scratch blocks (`.sb3`) via an embedded TurboWarp editor.  No build step or backend required — open `index.html` in any modern browser.

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/andy-and-terry/onlinecodeeditor.git
cd onlinecodeeditor

# Start any static file server – examples:
npx serve .                 # Node.js / npm
python3 -m http.server 8080 # Python 3

# Then open http://localhost:8080 (or the port shown)
```

> **Note:** Certain features (iframe `srcdoc`, `localStorage`) require the page to be served over HTTP/HTTPS rather than opened directly as a `file://` URL.

---

## File Structure

```
.
├── index.html                  Landing page → links to /editor/
├── README.md
├── assets/
│   ├── global.css              Shared dark-theme styles
│   ├── app.css                 Editor-specific styles
│   ├── app.js                  Editor logic (ES module)
│   ├── packager.js             ZIP packager (exports current project)
│   ├── translate.js            Language-to-language conversion pipeline
│   └── jszip-mini.js           Minimal dependency-free ZIP writer
├── editor/
│   ├── index.html              Editor shell (tabs, toolbar, panes)
│   └── turbowarp-embed.html    TurboWarp iframe bridge + postMessage scaffold
└── hiring/
    └── index.html              "Help us develop!" recruitment page
```

---

## Implemented Features

| Feature | Status |
|---|---|
| Text editor (`.html`, `.js`, `.vbs`, `.css`, `.txt`, custom) | ✅ Implemented |
| Tab-based multi-file editing | ✅ Implemented |
| File create / rename / delete | ✅ Implemented |
| Upload files (multi-select) | ✅ Implemented |
| Download individual file | ✅ Implemented |
| Live HTML preview pane | ✅ Implemented |
| Console / log pane | ✅ Implemented |
| Files list pane | ✅ Implemented |
| LocalStorage persistence | ✅ Implemented |
| ZIP packager (client-side) | ✅ Implemented |
| JS → HTML translation (wrap in `<script>`) | ✅ Implemented |
| HTML → JS translation (extract `<script>`) | ✅ Implemented |
| Unsupported translation error modal (delete/cancel) | ✅ Implemented |
| TurboWarp iframe embed for `.sb3` files | ✅ Scaffold implemented |
| Blocks ↔ JS via TurboWarp VM | 🔲 Placeholder (see below) |
| postMessage open/export `.sb3` | 🔲 Placeholder (see below) |

---

## Placeholders & Future Work

### Block Editor (TurboWarp)
The current implementation embeds `https://turbowarp.org/editor` in an iframe.  A `postMessage` scaffold is in place in `turbowarp-embed.html` but the full open/export wire-up requires **self-hosting a TurboWarp build** so that cross-origin restrictions don't block the message API.

Steps to complete:
1. Build TurboWarp locally: `git clone https://github.com/TurboWarp/scratch-gui && npm ci && npm run build`.
2. Place the build output in `editor/turbowarp/` and update the `src` in `turbowarp-embed.html`.
3. Implement the `tw-open-sb3` / `tw-export-sb3` postMessage handlers.

### Blocks ↔ JS Translation
Translating between Scratch blocks and JavaScript requires the Scratch VM's code-generation API.  The translate module returns a clear error with a "Delete / Cancel" modal until this is wired up.

### .sb3 ZIP Packaging
`.sb3` files are included as raw binary in the exported ZIP.  To produce a truly self-contained runnable HTML from a `.sb3`, use [packager.turbowarp.org](https://packager.turbowarp.org/) or integrate `@turbowarp/packager` into a build step.  See `assets/packager.js` for the placeholder note.

---

## Technology Choices

- **No framework, no build step** – plain ES modules served statically.
- **LocalStorage** for project persistence (IndexedDB is the recommended upgrade path for large binary files).
- **jszip-mini.js** – a hand-written ~200 line ZIP writer (CRC-32 + stored entries) to avoid any npm dependency.
- **TurboWarp** – chosen as the block editor engine (option 1A).

