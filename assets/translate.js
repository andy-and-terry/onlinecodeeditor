/**
 * translate.js – Language-to-language conversion pipeline.
 *
 * Supported conversions
 * ─────────────────────
 *   js   → html   Wrap JS source in an HTML page with a <script> tag.
 *   html → js     Extract the *first* <script> block's content.
 *   blocks → js   Placeholder – requires a self-hosted Scratch VM codegen.
 *   js → blocks   Placeholder – not feasible without full Scratch VM.
 *
 * Everything else is UNSUPPORTED and callers should show the
 * "Delete / Cancel" modal rather than silently failing.
 */

/**
 * Result object returned by `translate()`.
 * @typedef {{ ok: boolean, output?: string, error?: string }} TranslateResult
 */

/**
 * Translate `source` from one language to another.
 *
 * @param {string} from  – source language key ('js'|'html'|'blocks'|'vbs'|'text')
 * @param {string} to    – target language key
 * @param {string} source – the source code / content to translate
 * @returns {TranslateResult}
 */
function translate(from, to, source) {
  if (from === to) {
    return { ok: true, output: source };
  }

  // ── JS → HTML ─────────────────────────────────────────────────────────
  if (from === 'js' && to === 'html') {
    return {
      ok: true,
      output: jsToHtml(source),
    };
  }

  // ── HTML → JS ─────────────────────────────────────────────────────────
  if (from === 'html' && to === 'js') {
    return htmlToJs(source);
  }

  // ── Blocks → JS (placeholder) ─────────────────────────────────────────
  if (from === 'blocks' && to === 'js') {
    return {
      ok: false,
      error:
        'Blocks → JavaScript conversion requires a self-hosted Scratch VM ' +
        'with code-generation support, which is not yet integrated. ' +
        'You can delete the current code and start fresh, or cancel.',
    };
  }

  // ── JS → Blocks (placeholder) ─────────────────────────────────────────
  if (from === 'js' && to === 'blocks') {
    return {
      ok: false,
      error:
        'JavaScript → Blocks conversion is not supported. ' +
        'Scratch blocks represent a visual, event-driven paradigm that cannot ' +
        'be automatically reconstructed from arbitrary JS. ' +
        'You can delete the current code and start a new Scratch project, or cancel.',
    };
  }

  // ── Anything involving VBS ────────────────────────────────────────────
  if (from === 'vbs' || to === 'vbs') {
    return {
      ok: false,
      error:
        `VBScript ↔ ${to === 'vbs' ? from : to} translation is not supported. ` +
        'VBScript has no automated conversion path in this editor. ' +
        'You can delete the current code or cancel the operation.',
    };
  }

  // ── All other combos are unsupported ──────────────────────────────────
  const fromLabel = languageLabel(from);
  const toLabel   = languageLabel(to);
  return {
    ok: false,
    error:
      `${fromLabel} → ${toLabel} translation is not supported. ` +
      'You can delete the current code and start fresh, or cancel the operation.',
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Number of spaces used to indent JS code inside a generated HTML <script> block. */
const SCRIPT_INDENT_SPACES = 4;

/**
 * Wrap a JS string in a minimal HTML page.
 * @param {string} js
 * @returns {string}
 */
function jsToHtml(js) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Page</title>
</head>
<body>
  <script>
${indent(js, SCRIPT_INDENT_SPACES)}
  <\/script>
</body>
</html>`;
}

/**
 * Extract the first <script> block from an HTML string.
 * @param {string} html
 * @returns {TranslateResult}
 */
function htmlToJs(html) {
  // Match opening <script ...> and closing </script ...> permissively to handle
  // variations with extra whitespace or attributes in either tag.
  const match = html.match(/<script(?:\s[^>]*)?>([^]*?)<\/script[^>]*>/i);
  if (!match) {
    return {
      ok: false,
      error:
        'No <script> block was found in the HTML source. ' +
        'You can delete the current code and start fresh in JS, or cancel.',
    };
  }
  return { ok: true, output: match[1].trim() };
}

/** @param {string} code @param {number} spaces */
function indent(code, spaces) {
  const pad = ' '.repeat(spaces);
  return code.split('\n').map(line => pad + line).join('\n');
}

/** @param {string} key @returns {string} */
function languageLabel(key) {
  const map = {
    js:     'JavaScript',
    html:   'HTML',
    blocks: 'Scratch Blocks',
    vbs:    'VBScript',
    text:   'Plain Text',
  };
  return map[key] || key;
}
