/* ============================================================
   THEME ENGINE — rewrites the token layer at runtime.
   Every surface, glow, particle and the atom read the same
   CSS variables, so one call restyles the entire system.
   ============================================================ */
import { state, emitChange } from './state.js';

export const PRESETS = [
  { n: 'Obsidian Gold', accent: '#d4a84c', bg: '#050505', font: 'Space Grotesk|Inter', mode: 'dark' },
  { n: 'Liquid Mercury', accent: '#c9d4e0', bg: '#060708', font: 'Space Grotesk|Inter', mode: 'dark' },
  { n: 'Titanium', accent: '#9fb2c4', bg: '#07090b', font: 'Inter|Inter', mode: 'dark' },
  { n: 'Sapphire', accent: '#6d9dff', bg: '#04060d', font: 'Space Grotesk|Inter', mode: 'dark' },
  { n: 'Emerald', accent: '#3fe8a0', bg: '#030a06', font: 'Space Grotesk|Inter', mode: 'dark' },
  { n: 'Chrome', accent: '#e8edf2', bg: '#050506', font: 'Inter|Inter', mode: 'dark' },
  { n: 'Rose Metal', accent: '#f0a8b4', bg: '#0a0507', font: 'Space Grotesk|Inter', mode: 'dark' },
  { n: 'Amethyst', accent: '#c084ff', bg: '#070410', font: 'Space Grotesk|Inter', mode: 'dark' },
  { n: 'Molten', accent: '#ff8f3d', bg: '#0b0503', font: 'Space Grotesk|Inter', mode: 'dark' },
  { n: 'Graphite', accent: '#a8a8a8', bg: '#060606', font: 'JetBrains Mono|Inter', mode: 'dark' },
  { n: 'Aqua HUD', accent: '#28e0f0', bg: '#03080a', font: 'Space Grotesk|Inter', mode: 'dark' },
  { n: 'Frost Glass', accent: '#8a6f2e', bg: '#ecebe6', font: 'Space Grotesk|Inter', mode: 'light' },
];

export const ACCENTS = ['#d4a84c', '#f5d06a', '#c9d4e0', '#9fb2c4', '#6d9dff', '#3fe8a0', '#e8edf2', '#f0a8b4', '#c084ff', '#ff8f3d', '#28e0f0', '#ff4d70'];
export const BACKGROUNDS = ['#050505', '#000000', '#04060d', '#030a06', '#0a0507', '#070410', '#0b0503', '#06070a', '#03080a', '#080808', '#0a0908', '#060406'];
export const FONTS = [
  { label: 'Space Grotesk · Inter', tag: 'Instrument', v: 'Space Grotesk|Inter' },
  { label: 'Inter · Inter', tag: 'Product', v: 'Inter|Inter' },
  { label: 'JetBrains Mono · Inter', tag: 'Terminal', v: 'JetBrains Mono|Inter' },
  { label: 'Playfair Display · Inter', tag: 'Editorial', v: 'Playfair Display|Inter' },
  { label: 'Cinzel · Cormorant Garamond', tag: 'Royal (legacy)', v: 'Cinzel|Cormorant Garamond' },
  { label: 'Cormorant Garamond', tag: 'Classic serif', v: 'Cormorant Garamond|Cormorant Garamond' },
];

/* ---------- color math ---------- */
function hexRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const toHex = (rgb) => '#' + rgb.map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
const scale = (rgb, f) => rgb.map((v) => v * f);
const lift = (rgb, n) => rgb.map((v) => v + n);
export const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim());

/* ---------- apply ---------- */
export function applyAccent(hex) {
  if (!isHex(hex)) return;
  const rgb = hexRgb(hex);
  const r = document.documentElement.style;
  r.setProperty('--accent', hex);
  r.setProperty('--accent-rgb', rgb.join(', '));
  r.setProperty('--accent-lt', toHex(scale(rgb, 1.26).map((v, i) => v + [16, 12, 8][i])));
  r.setProperty('--accent-mid', toHex(scale(rgb, 0.82)));
  r.setProperty('--accent-dk', toHex(scale(rgb, 0.5)));
  r.setProperty('--accent-pale', toHex(lift(scale(rgb, 0.35), 170)));
}

export function applyBg(hex) {
  if (!isHex(hex)) return;
  const rgb = hexRgb(hex);
  const r = document.documentElement.style;
  r.setProperty('--bg', hex);
  r.setProperty('--bg-1', toHex(lift(rgb, 7)));
  r.setProperty('--bg-2', toHex(lift(rgb, 14)));
  r.setProperty('--bg-3', toHex(lift(rgb, 21)));
}

const loadedFonts = new Set();
export function applyFont(pair) {
  if (!pair) return;
  const [display, body] = pair.split('|');
  for (const f of [display, body]) {
    if (loadedFonts.has(f)) continue;
    loadedFonts.add(f);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }
  const serif = /Playfair|Cinzel|Cormorant|Garamond/i.test(pair);
  const fb = serif ? 'serif' : 'sans-serif';
  const r = document.documentElement.style;
  r.setProperty('--font-display', `'${display}', ${fb}`);
  r.setProperty('--font-body', `'${body}', ${fb}`);
}

export function applyMode(mode) {
  document.documentElement.dataset.mode = mode === 'light' ? 'light' : 'dark';
}

/** Apply a whole theme object { accent, bg, font, mode, preset } */
export function applyTheme(t) {
  if (!t) return;
  if (t.mode) applyMode(t.mode);
  if (t.accent) applyAccent(t.accent);
  if (t.bg) applyBg(t.bg);
  if (t.font) applyFont(t.font);
  syncStudio(t);
}

/** Update config.theme and re-apply (called by the theme studio) */
export function setTheme(patch) {
  Object.assign(state.config.theme, patch);
  applyTheme(state.config.theme);
  emitChange();
}

export function applyPreset(i) {
  const p = PRESETS[i];
  if (!p) return;
  setTheme({ preset: i, accent: p.accent, bg: p.bg, font: p.font, mode: p.mode });
}

/* ---------- studio UI state sync ---------- */
function syncStudio(t) {
  document.querySelectorAll('.preset').forEach((el, i) => el.classList.toggle('on', i === t.preset));
  document.querySelectorAll('#sw-accent .swatch').forEach((el) => el.classList.toggle('on', el.dataset.v === t.accent));
  document.querySelectorAll('#sw-bg .swatch').forEach((el) => el.classList.toggle('on', el.dataset.v === t.bg));
  document.querySelectorAll('#font-opts .font-opt').forEach((el) => el.classList.toggle('on', el.dataset.v === t.font));
  document.querySelectorAll('#mode-toggle .font-opt').forEach((el) => el.classList.toggle('on', el.dataset.v === (t.mode || 'dark')));
}

/* ---------- build studio controls ---------- */
export function buildStudio() {
  const presets = document.getElementById('presets');
  presets.innerHTML = '';
  PRESETS.forEach((p, i) => {
    const el = document.createElement('button');
    el.className = 'preset';
    el.type = 'button';
    el.title = p.n;
    el.style.background = `linear-gradient(135deg, ${p.bg}, ${p.accent}88, ${p.accent})`;
    el.innerHTML = `<span>${p.n}</span>`;
    el.addEventListener('click', () => applyPreset(i));
    presets.appendChild(el);
  });

  const mkSwatches = (id, values, key) => {
    const box = document.getElementById(id);
    box.innerHTML = '';
    values.forEach((v) => {
      const el = document.createElement('button');
      el.className = 'swatch';
      el.type = 'button';
      el.dataset.v = v;
      el.style.background = key === 'accent'
        ? `linear-gradient(135deg, ${v}33, ${v})`
        : v;
      el.title = v;
      el.addEventListener('click', () => setTheme({ [key]: v, preset: -1 }));
      box.appendChild(el);
    });
  };
  mkSwatches('sw-accent', ACCENTS, 'accent');
  mkSwatches('sw-bg', BACKGROUNDS, 'bg');

  const fonts = document.getElementById('font-opts');
  fonts.innerHTML = '';
  FONTS.forEach((f) => {
    const el = document.createElement('button');
    el.className = 'font-opt';
    el.type = 'button';
    el.dataset.v = f.v;
    el.innerHTML = `${f.label}<small>${f.tag}</small>`;
    el.addEventListener('click', () => setTheme({ font: f.v, preset: -1 }));
    fonts.appendChild(el);
  });

  const modes = document.getElementById('mode-toggle');
  modes.innerHTML = '';
  [['dark', '● Dark · OLED'], ['light', '○ Light · Frost']].forEach(([v, label]) => {
    const el = document.createElement('button');
    el.className = 'font-opt';
    el.type = 'button';
    el.dataset.v = v;
    el.textContent = label;
    el.addEventListener('click', () => setTheme({ mode: v, preset: -1 }));
    modes.appendChild(el);
  });

  syncStudio(state.config.theme);
}
