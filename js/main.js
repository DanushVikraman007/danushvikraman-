/* ============================================================
   MAIN — boot sequence and wiring.
   load config → apply theme → render → mount atom & field →
   navigation → edit machinery.
   ============================================================ */
import { loadConfig, onChange, cacheConfig, exportConfigFile, state } from './state.js';
import { applyTheme, buildStudio } from './theme.js';
import { renderAll, renderDetail } from './render.js';
import { mountAtom } from './atom.js';
import { mountField } from './particles.js';
import {
  requestEdit, exitEdit, isEditMode, bindEditables,
  openConsole, publish, closeSheet, setStatus, onRerender,
} from './admin.js';

const $ = (id) => document.getElementById(id);
let currentDetail = null;

/* ---------- navigation between the two spaces ---------- */
function goHome() {
  currentDetail = null;
  $('home').dataset.state = 'active';
  $('detail').dataset.state = 'right';
  history.replaceState(null, '', location.pathname);
}
function openDetail(id) {
  currentDetail = id;
  renderDetail(id);
  bindEditables();
  $('detail').scrollTop = 0;
  $('home').dataset.state = 'left';
  $('detail').dataset.state = 'active';
  history.replaceState(null, '', `#${id}`);
}

/* ---------- boot ---------- */
async function boot() {
  try {
    await loadConfig();
  } catch (e) {
    document.body.innerHTML = `<div style="display:grid;place-items:center;height:100vh;font-family:monospace;color:#d4a84c;text-align:center;padding:2rem">
      site-config.json failed to load.<br><br>
      If you opened this file directly (file://), run a local server instead:<br>
      <code style="opacity:.7">python3 -m http.server</code> → open http://localhost:8000</div>`;
    throw e;
  }

  applyTheme(state.config.theme);
  buildStudio();
  renderAll(isEditMode(), currentDetail);
  mountAtom($('atom'), { tl: $('hud-tl'), tr: $('hud-tr'), bl: $('hud-bl') });
  mountField($('field'));

  // deep-link: /#projects opens that module directly
  const hash = location.hash.slice(1);
  if (hash && state.config.sections.some((s) => s.id === hash)) openDetail(hash);

  /* re-render on any config change, preserving the current view */
  onChange(() => {
    cacheConfig();
    renderAll(isEditMode(), currentDetail);
    bindEditables();
  });
  onRerender(() => {
    renderAll(isEditMode(), currentDetail);
    bindEditables();
  });

  /* delegated clicks */
  document.addEventListener('click', (e) => {
    // don't navigate while editing text inline
    const opener = e.target.closest('[data-open]');
    if (opener && !(isEditMode() && e.target.closest('[data-path]'))) {
      e.preventDefault();
      openDetail(opener.dataset.open);
      return;
    }
    if (e.target.closest('[data-back]') || e.target.closest('[data-home]')) { e.preventDefault(); goHome(); return; }
    if (e.target.closest('[data-edit-toggle]')) { requestEdit(); return; }
    if (e.target.closest('#module-add')) { if (isEditMode()) openConsole(); return; }
    if (e.target.closest('[data-console]')) { if (isEditMode()) openConsole(); return; }
    if (e.target.closest('[data-publish]')) { publish(); return; }
    if (e.target.closest('[data-export]')) { exportConfigFile(); setStatus('site-config.json downloaded'); return; }
    if (e.target.closest('[data-exit]')) { exitEdit(); return; }

    if (e.target.closest('[data-studio-toggle]')) { $('theme-studio').classList.toggle('open'); return; }
    if (e.target.closest('[data-studio-close]')) { $('theme-studio').classList.remove('open'); return; }
    // click outside closes studio / modal
    if (!e.target.closest('#theme-studio')) $('theme-studio').classList.remove('open');
    if (e.target.id === 'dyn-overlay') closeSheet();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSheet();
      $('theme-studio').classList.remove('open');
    }
  });

  // warn before leaving with unpublished edits
  addEventListener('beforeunload', (e) => {
    if (state.dirty && isEditMode()) { e.preventDefault(); e.returnValue = ''; }
  });
}

boot();
