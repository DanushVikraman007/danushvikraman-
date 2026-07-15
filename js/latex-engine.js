/* ============================================================
   LATEX-ENGINE — local, in-browser LaTeX compiler.

   Wraps texlyre-busytex (a WASM port of TeX Live's pdfTeX,
   https://github.com/TeXlyre/texlyre-busytex, AGPL-3.0) so the rest
   of the app only ever sees compileLatex(tex) -> { ok, pdf, log }.

   NOTHING in this module makes a network request. All compilation
   happens inside the browser tab, using WASM + data files that are
   vendored into this repository at resume/vendor/busytex/. The only
   "fetch" calls below are same-origin requests for those local
   static files (JS glue, .wasm binaries, .data package archives) —
   exactly like loading an image or a stylesheet, not a compile API.

   Lazy: the engine is not created until compileLatex() is first
   called (i.e. not until the person is in Résumé Mode and clicks
   Generate PDF). Once initialized it is kept warm in memory for the
   rest of the page session so a second résumé generation is fast.
   ============================================================ */

// Resolved relative to this module's own URL so the app keeps working
// when served from a GitHub Pages *project* subpath
// (https://user.github.io/repo/…), not just from a domain root.
const VENDOR_BASE = new URL('../resume/vendor/busytex/', import.meta.url).href;

let runnerPromise = null;   // BusyTexRunner init, memoized for the session
let enginePromise = null;   // PdfLatex instance, memoized alongside it

/** Lazily import texlyre-busytex and boot a pdfTeX-only runner. */
async function getEngine() {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    const { BusyTexRunner, PdfLatex } = await import('texlyre-busytex');

    const runner = new BusyTexRunner({
      busytexBasePath: VENDOR_BASE,
      engineMode: 'pdftex', // smaller split build — this template never needs XeTeX/LuaTeX
      // Packages resume-template.tex actually \usepackage's, so BusyTeX
      // preloads them from the vendored data instead of trying to fetch
      // anything at compile time. Keep in sync with resume-template.tex.
      preloadDataPackages: [
        'mathptmx', 'geometry', 'hyperref', 'enumitem',
        'titlesec', 'xcolor', 'multicol', 'graphicx',
      ],
    });

    await runner.initialize(true); // true = run in a Web Worker (keeps the UI thread free)
    runnerPromise = runner;
    return new PdfLatex(runner);
  })();

  return enginePromise;
}

/**
 * Compile a LaTeX source string entirely inside the browser.
 * Returns { ok: true, pdf: Uint8Array, log } or { ok: false, log }.
 * Never throws for a LaTeX-level failure — only for engine load errors,
 * which the caller turns into a friendly message.
 */
export async function compileLatex(texSource) {
  let pdflatex;
  try {
    pdflatex = await getEngine();
  } catch (e) {
    // Reset so a later retry can attempt a fresh load instead of
    // permanently replaying the same failed promise.
    enginePromise = null;
    throw new Error('Local LaTeX compiler failed to load.' + (e?.message ? ` (${e.message})` : ''));
  }

  const result = await pdflatex.compile({ input: texSource, verbose: 'silent' });
  const log = result.log || '';

  if (!result.success || !result.pdf) {
    return { ok: false, log: log || 'LaTeX compilation failed.' };
  }

  // Sanity-check the output is actually a PDF before handing it back —
  // never let a partial/garbled buffer masquerade as success.
  const head = result.pdf.slice(0, 5);
  const sig = String.fromCharCode(...head);
  if (sig !== '%PDF-') {
    return { ok: false, log: log || 'Compiler returned output that is not a valid PDF.' };
  }

  return { ok: true, pdf: result.pdf, log };
}

/** Free the worker + WASM memory. Call when leaving Résumé Mode if you
    want to reclaim memory immediately; otherwise the engine simply stays
    warm for the rest of the tab's life, which is usually what you want. */
export function disposeLatexEngine() {
  if (runnerPromise) { try { runnerPromise.terminate(); } catch { /* already gone */ } }
  runnerPromise = null;
  enginePromise = null;
}
