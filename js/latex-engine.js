/* ============================================================
   LATEX-ENGINE — local, in-browser LaTeX compiler.

   Wraps texlyre-busytex (a WASM port of TeX Live's pdfTeX,
   https://github.com/TeXlyre/texlyre-busytex, AGPL-3.0) so the rest
   of the app only ever sees compileLatex(tex) -> { ok, pdf, log }.

   NOTHING in this module makes a network request. All compilation
   happens inside the browser tab, using WASM + data files that are
   vendored into this repository at resume/vendor/ (both the library's
   own dist/index.js and the busytex/ WASM+data bundle — see
   README-latex-engine.md). The only "fetch" calls below are same-origin
   requests for those local static files (JS glue, .wasm binaries, .data
   package archives) — exactly like loading an image or a stylesheet,
   not a compile API.

   IMPORTANT: `texlyre-busytex` is an npm package name, not a URL — a
   plain <script type="module"> browser has no registry to resolve that
   against, so `import ... from 'texlyre-busytex'` fails with "Failed to
   resolve module specifier" on GitHub Pages (no bundler, no import map).
   The fix is to import the package's own prebuilt ESM file
   (dist/index.js, which has zero runtime dependencies of its own) by a
   real relative path once it's vendored into the repo. See
   README-latex-engine.md step 1.

   Lazy: the engine is not created until compileLatex() is first
   called (i.e. not until the person is in Résumé Mode and clicks
   Generate PDF). Once initialized it is kept warm in memory for the
   rest of the page session so a second résumé generation is fast.
   ============================================================ */

// Resolved relative to this module's own URL so the app keeps working
// when served from a GitHub Pages *project* subpath
// (https://user.github.io/repo/…), not just from a domain root.
const VENDOR_DIR = new URL('../resume/vendor/', import.meta.url).href;
const BUSYTEX_LIB = `${VENDOR_DIR}texlyre-busytex/index.js`; // vendored dist/index.js
const VENDOR_BASE = `${VENDOR_DIR}busytex/`;                 // vendored WASM + TeX Live data

let runnerPromise = null;   // BusyTexRunner init, memoized for the session
let enginePromise = null;   // PdfLatex instance, memoized alongside it

/** Lazily import the vendored texlyre-busytex build and boot a pdfTeX-only runner. */
async function getEngine() {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    const { BusyTexRunner, PdfLatex } = await import(/* @vite-ignore */ BUSYTEX_LIB);

    const runner = new BusyTexRunner({
      busytexBasePath: VENDOR_BASE,
      engineMode: 'pdftex', // smaller split build — this template never needs XeTeX/LuaTeX
      // No preloadDataPackages list here: pdfTeX's bundled texlive-basic
      // data already resolves packages from texlive-recommended and
      // texlive-extra (which is where titlesec, enumitem, etc. live) —
      // see the "Limitations" section of the texlyre-busytex README.
      // If a future template addition needs a package that genuinely
      // isn't covered, the fix is to list its real package-data URL
      // here (copied from the vendored busytex/ catalog), not a guess.
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
