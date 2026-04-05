# Contributing to Mini Scratch

Thanks for your interest in contributing! Mini Scratch is a no-build, no-framework browser-based code editor — contributions of all sizes are welcome.

## Ways to Contribute

- **Report bugs** – Open a [GitHub Issue](https://github.com/andy-and-terry/onlinecodeeditor/issues) with steps to reproduce, expected vs. actual behavior, and your browser/OS.
- **Suggest features** – Open an issue tagged `enhancement` describing the use-case and proposed approach.
- **Submit a pull request** – Fork the repo, make your changes on a feature branch, and open a PR against `main`.

## Development Setup

```bash
git clone https://github.com/andy-and-terry/onlinecodeeditor.git
cd onlinecodeeditor

# Serve with any static server:
npx serve .                 # Node.js
python3 -m http.server 8080 # Python 3

# Open http://localhost:8080
```

> Certain features (iframe `srcdoc`, `localStorage`) require HTTP/HTTPS — don't open `index.html` as a `file://` URL.

## Project Structure

```
.
├── index.html          Landing page
├── assets/
│   ├── global.css      Shared dark-theme styles
│   ├── app.css         Editor-specific styles
│   ├── app.js          Editor logic (ES module)
│   ├── translate.js    Language translation pipeline
│   ├── packager.js     Client-side ZIP packager
│   └── jszip-mini.js   Lightweight ZIP writer (~200 lines)
├── editor/
│   ├── index.html           Editor shell (tabs, toolbar, panes)
│   └── turbowarp-embed.html TurboWarp iframe bridge
├── hiring/
│   └── index.html      "Join the Team" page
└── README.md
```

## Code Style

- **No framework, no build step** – plain ES modules served statically. Keep it that way.
- Match the style of the file you are editing (indentation, quote style, naming).
- Avoid adding new npm dependencies unless absolutely necessary; prefer small self-contained solutions like `jszip-mini.js`.
- No minification or bundling — source files are served directly.

## Pull Request Checklist

- [ ] Tested in at least one modern browser (Chrome, Firefox, or Safari)
- [ ] No unrelated files changed
- [ ] New dependencies justified and checked for known vulnerabilities
- [ ] README updated if the file structure or feature list changed

## Formal Contributor Path

If you'd like a more structured involvement with the project, you can also apply via the [Join the Team](https://andy-and-terry.github.io/onlinecodeeditor/hiring/) page.
