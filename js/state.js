/* ============================================================
   STATE — single config object, deep path access, local cache.
   The entire site renders from `state.config` (site-config.json).
   ============================================================ */

const CACHE_KEY = 'qos_config_v2';
const TOKEN_KEY = 'qos_gh_token';

export const state = {
  config: null,
  dirty: false,
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
export function emitChange() {
  state.dirty = true;
  listeners.forEach((fn) => fn(state.config));
}

/* ---------- deep path helpers: "sections.2.items.0.title" ---------- */
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= /^\d+$/.test(k) ? [] : {}), obj);
  target[last] = value;
}

/* ---------- local cache ---------- */
export function cacheConfig() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state.config)); } catch { /* quota */ }
}
export function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    return cfg && cfg.sections ? cfg : null;
  } catch { return null; }
}

/* ---------- GitHub token (device-local, never inside the config) ---------- */
export function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
export function saveToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

/* ---------- config loading: repo file → local cache → bundled file ---------- */
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function loadConfig() {
  const candidates = ['./site-config.json?v=' + Date.now()];
  // On github.io also try raw.githubusercontent (fresher than Pages CDN)
  const meta = document.querySelector('meta[name="github-owner"]');
  if (location.hostname.endsWith('.github.io')) {
    const owner = meta?.content || location.hostname.replace('.github.io', '');
    const seg = location.pathname.split('/').filter(Boolean)[0];
    const repo = document.querySelector('meta[name="github-repo"]')?.content || seg || `${owner}.github.io`;
    const branch = document.querySelector('meta[name="github-branch"]')?.content || 'main';
    candidates.unshift(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/site-config.json?t=${Date.now()}`);
  }

  let remote = null;
  for (const url of candidates) {
    try { remote = await fetchJson(url); if (remote?.sections) break; remote = null; } catch { /* next */ }
  }

  const cached = readCache();
  // Prefer whichever is newer; unsaved local edits win over a stale remote.
  if (remote && cached) {
    state.config = (cached.updatedAt || 0) > (remote.updatedAt || 0) ? cached : remote;
  } else {
    state.config = remote || cached;
  }
  if (!state.config) throw new Error('site-config.json could not be loaded');
  cacheConfig();
  return state.config;
}

/* ---------- section helpers ---------- */
export function sections() { return state.config.sections; }
export function sectionById(id) { return sections().find((s) => s.id === id); }
export function sectionIndex(id) { return sections().findIndex((s) => s.id === id); }

export function moveSection(id, delta) {
  const arr = sections();
  const i = sectionIndex(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  emitChange();
}

export function reorderSection(fromId, toId) {
  const arr = sections();
  const from = sectionIndex(fromId);
  const to = sectionIndex(toId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  emitChange();
}

/* ---------- stable item IDs + résumé selection ----------
   Cards were historically addressed by array index, which breaks the
   moment anything is reordered. Every item now carries a stable `_id`
   (deterministic slug of its section + label, so independent devices
   derive identical IDs without publishing). The résumé selection only
   stores these IDs — content is never duplicated out of the sections. */
export function slugId(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '') || 'item';
}

const itemLabelOf = (it) => it.title || it.heading || it.group || it.label || it.k || 'item';

/** Assign missing `_id`s (and repair duplicates) in place. Returns true if
    anything changed. Deterministic: same content ⇒ same IDs on any device. */
export function ensureItemIds(cfg = state.config) {
  let changed = false;
  const seen = new Set();
  for (const s of cfg?.sections || []) {
    for (const it of s.items || []) {
      if (!it || typeof it !== 'object') continue;
      if (it._id && !seen.has(it._id)) { seen.add(it._id); continue; }
      const base = `${s.id}_${slugId(itemLabelOf(it))}`;
      let id = base;
      for (let n = 2; seen.has(id); n += 1) id = `${base}-${n}`;
      it._id = id;
      seen.add(id);
      changed = true;
    }
  }
  return changed;
}

export function validItemIds(cfg = state.config) {
  const ids = new Set();
  for (const s of cfg?.sections || []) {
    for (const it of s.items || []) if (it?._id) ids.add(it._id);
  }
  return ids;
}

function resumeSelection() {
  const c = state.config;
  c.resume ??= {};
  c.resume.selectedItems ??= [];
  return c.resume.selectedItems;
}

export const isItemSelected = (id) => resumeSelection().includes(id);

export function toggleItemSelected(id) {
  if (!id) return;
  const sel = resumeSelection();
  const i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1);
  else sel.push(id);
  emitChange();
}

/** Deleted cards are safely forgotten: drop selection IDs that no longer
    resolve. Silent (no emit) — callers refresh their own UI. */
export function pruneResumeSelection() {
  const valid = validItemIds();
  const sel = resumeSelection();
  const before = sel.length;
  for (let i = sel.length - 1; i >= 0; i -= 1) {
    if (!valid.has(sel[i])) sel.splice(i, 1);
  }
  if (sel.length !== before) cacheConfig();
  return before - sel.length;
}

export function exportConfigFile() {
  const blob = new Blob([JSON.stringify(state.config, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'site-config.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
