/* ============================================================
   RESUME MODE — a selection layer on top of the normal portfolio.

   Flow: passcode → Edit Mode → Résumé Mode → tick cards →
   Generate PDF → preview → print / download.

   • Only reachable from authenticated edit mode; exiting edit
     mode (qos:edit-exit) always exits Résumé Mode too.
   • Cards are never duplicated: selection stores stable item IDs
     (config.resume.selectedItems) — the portfolio JSON remains
     the single source of truth.
   • Generation is delegated to js/resume-latex.js (pure layer).
   ============================================================ */
import {
  state, getPath, sections, cacheConfig,
  ensureItemIds, isItemSelected, toggleItemSelected,
  pruneResumeSelection, validItemIds,
} from './state.js';
import { isEditMode, openSheet, closeSheet } from './admin.js';
import {
  buildResumeJson, renderResumeTex, compileResumeTex,
  countPdfPages, resumePdfFilename, isResumeEligible,
} from './resume-latex.js';

const $ = (id) => document.getElementById(id);
const escHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ================= MODE STATE ================= */
let resumeMode = false;
export const isResumeMode = () => resumeMode;

export function enterResumeMode() {
  if (!isEditMode() || resumeMode) return;      // edit-mode auth is the gate
  if (ensureItemIds()) cacheConfig();           // stable IDs before any selection
  pruneResumeSelection();                       // drop refs to deleted cards
  resumeMode = true;
  document.body.classList.add('resume-mode');
  refreshResumeUI();
}

export function exitResumeMode() {
  if (!resumeMode) return;
  resumeMode = false;
  document.body.classList.remove('resume-mode');
  refreshResumeUI();
}

export const toggleResumeMode = () => (resumeMode ? exitResumeMode() : enterResumeMode());

/** Wire the static toolbar + follow edit mode's lifecycle. */
export function initResumeMode() {
  document.querySelector('[data-resume-exit]')?.addEventListener('click', exitResumeMode);
  document.querySelector('[data-resume-generate]')?.addEventListener('click', generateResume);
  document.addEventListener('qos:edit-exit', exitResumeMode);
}

/* ================= TOOLBAR STATUS ================= */
function rstatus(msg) {
  const el = $('resume-status');
  if (!el) return;
  el.textContent = msg;
  clearTimeout(rstatus._t);
  rstatus._t = setTimeout(updateBar, 4000);
}

function selectionCount() {
  const valid = validItemIds();
  return (state.config.resume?.selectedItems || []).filter((id) => valid.has(id)).length;
}

function updateBar() {
  const el = $('resume-status');
  if (!el) return;
  const n = selectionCount();
  el.textContent = `Résumé mode · ${n} card${n === 1 ? '' : 's'} selected`;
}

/* ================= CARD DECORATION =================
   Re-applied after every render (main.js calls refreshResumeUI).
   Cards themselves are untouched: one checkbox chip is appended,
   one class marks selection. */
export function refreshResumeUI() {
  // detail-view cards → selection chips
  document.querySelectorAll('#detail-body [data-item]').forEach((panel) => {
    panel.querySelector(':scope > .resume-pick')?.remove();
    panel.classList.remove('resume-picked');
    if (!resumeMode) return;

    const it = getPath(state.config, panel.dataset.item);
    if (!it || !it._id) return;
    const on = isItemSelected(it._id);
    panel.classList.toggle('resume-picked', on);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `resume-pick${on ? ' on' : ''}`;
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Remove from résumé' : 'Include in résumé';
    btn.innerHTML = `<span class="rp-box">${on ? '✓' : ''}</span><span>Include in résumé</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleItemSelected(it._id); // emitChange → re-render → re-decorate
    });
    panel.appendChild(btn);
  });

  // home module cards → per-section tally
  document.querySelectorAll('#modules .module').forEach((card) => {
    card.querySelector(':scope > .resume-count')?.remove();
    if (!resumeMode) return;
    const s = sections().find((x) => x.id === card.dataset.open);
    if (!s) return;

    const chip = document.createElement('span');
    chip.className = 'resume-count';
    if (s.type === 'contact') chip.textContent = '→ header';
    else if (!isResumeEligible(s)) return;
    else {
      const n = (s.items || []).filter((it) => it._id && isItemSelected(it._id)).length;
      chip.textContent = `${n}/${(s.items || []).length} selected`;
      chip.classList.toggle('some', n > 0);
    }
    card.appendChild(chip);
  });

  updateBar();
}

/* ================= GENERATE → PREVIEW ================= */
let templateCache = null;
let compact = false;
let busy = false;
let lastResume = null;
let lastTex = '';
let pdfBuf = null;
let blobUrl = null;

async function fetchTemplate() {
  if (templateCache) return templateCache;
  const res = await fetch('./resume/resume-template.tex', { cache: 'no-store' });
  if (!res.ok) throw new Error(`resume-template.tex could not be loaded (HTTP ${res.status})`);
  const text = await res.text();
  if (!text.includes('%%BODY%%')) throw new Error('resume-template.tex is missing its %%BODY%% marker');
  templateCache = text;
  return text;
}

function releaseBlob() {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = null;
}

async function generateResume() {
  if (!isEditMode() || !resumeMode || busy) return;
  if (ensureItemIds()) cacheConfig();
  pruneResumeSelection();

  lastResume = buildResumeJson(state.config);
  const total = lastResume.sections.reduce((n, s) => n + s.items.length, 0);
  if (!total) { rstatus('Nothing selected — tick “Include in résumé” on some cards first'); return; }

  openPreviewSheet();
  compileAndShow();
}

function openPreviewSheet() {
  const sheet = openSheet(`
    <div class="sheet-crest">Résumé</div>
    <div class="sheet-title">Generated résumé</div>
    <div id="rs-body"></div>
    <div class="sheet-actions" style="justify-content:space-between">
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="btn quiet" data-r="compact"></button>
        <button class="btn quiet" data-r="tex" title="Download the LaTeX source">.tex</button>
        <button class="btn quiet" data-r="json" title="Download the intermediate resume.json">resume.json</button>
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="btn quiet" data-r="print">Print</button>
        <button class="btn primary" data-r="pdf">Download PDF</button>
        <button class="btn quiet" data-r="close">Close</button>
      </div>
    </div>`, true);
  sheet.classList.add('resume-sheet');

  const on = (key, fn) => sheet.querySelector(`[data-r="${key}"]`).addEventListener('click', fn);
  on('close', () => { releaseBlob(); closeSheet(); });
  on('compact', () => { if (!busy) { compact = !compact; compileAndShow(); } });
  on('tex', () => lastTex && download(lastTex, 'text/x-tex', 'resume.tex'));
  on('json', () => lastResume && download(JSON.stringify(lastResume, null, 2), 'application/json', 'resume.json'));
  on('pdf', () => pdfBuf && download(pdfBuf, 'application/pdf', resumePdfFilename(lastResume?.header?.name)));
  on('print', printPdf);
  syncCompactLabel();
}

const sheetEl = () => document.querySelector('#dyn-overlay .sheet.resume-sheet');

function syncCompactLabel() {
  const b = sheetEl()?.querySelector('[data-r="compact"]');
  if (b) b.textContent = `Tighter spacing: ${compact ? 'on' : 'off'}`;
}

async function compileAndShow() {
  const body = sheetEl()?.querySelector('#rs-body');
  if (!body || !lastResume) return;
  busy = true;
  syncCompactLabel();
  body.innerHTML = `<p class="sheet-sub" style="margin-bottom:.6rem">Compiling locally in your browser… first run loads the LaTeX engine, so this can take a little longer than later ones.</p>
    <div class="resume-frame resume-frame-wait">⌛</div>`;

  try {
    const template = await fetchTemplate();
    const { tex, dropped } = renderResumeTex(lastResume, template, { compact });
    lastTex = tex;

    const res = await compileResumeTex(tex);
    if (!res.ok) {
      body.innerHTML = `
        <p class="err" style="min-height:0">LaTeX compilation failed.</p>
        <pre class="resume-log">${escHtml((res.log || '').slice(-4000))}</pre>
        <p class="field-hint">You can still download the .tex below.</p>`;
      return;
    }

    pdfBuf = res.pdf;
    releaseBlob();
    blobUrl = URL.createObjectURL(new Blob([pdfBuf], { type: 'application/pdf' }));
    const pages = await countPdfPages(pdfBuf);

    body.innerHTML = `
      ${pages > 1 ? `<p class="resume-warn">Selected content exceeds the recommended one-page résumé length (${pages} pages). Try “Tighter spacing”, or unselect a few cards — nothing is removed automatically.</p>` : ''}
      ${dropped ? `<p class="field-hint">${dropped} character${dropped > 1 ? 's' : ''} without a safe LaTeX form ${dropped > 1 ? 'were' : 'was'} omitted.</p>` : ''}
      <iframe class="resume-frame" title="Résumé preview" src="${blobUrl}#toolbar=0&navpanes=0"></iframe>
      <p class="field-hint">${pages ? `${pages} page${pages > 1 ? 's' : ''} · ` : ''}compiled locally in your browser — your résumé text never leaves this device. Preview blank on this device? <a href="${blobUrl}" target="_blank" rel="noopener">Open the PDF in a new tab</a>.</p>`;
  } catch (e) {
    body.innerHTML = `<p class="err" style="min-height:0">${escHtml(e?.message || String(e))}</p>`;
  } finally {
    busy = false;
  }
}

function printPdf() {
  if (!blobUrl) return;
  const frame = sheetEl()?.querySelector('iframe.resume-frame');
  try {
    frame.contentWindow.focus();
    frame.contentWindow.print();          // prints the PDF itself, not the page
  } catch {
    window.open(blobUrl, '_blank');       // fallback: browser PDF viewer → print there
  }
}

function download(data, type, filename) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
