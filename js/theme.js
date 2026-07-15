/* ============================================================
   THEME ENGINE — rewrites the token layer at runtime.
   Every surface, glow, particle and the atom read the same
   CSS variables, so one call restyles the entire system.

   Dark only. A large library of fully-tuned material presets —
   each an accent + background + font triplet, not just a hue
   swap, so switching presets feels like switching materials, not
   repainting one page. Spans gold / royal / ancient / cinematic /
   tech / noir / nature / ocean genres.
   ============================================================ */
import { state, emitChange } from './state.js';

export const PRESETS = [
  // ---- GOLD / METALLIC ----
  { n: 'Obsidian Gold',   accent: '#d4a84c', bg: '#050505', font: 'Space Grotesk|Inter' },
  { n: 'Rose Gold',       accent: '#e0a893', bg: '#0a0605', font: 'Playfair Display|Inter' },
  { n: 'Antique Brass',   accent: '#b8874a', bg: '#0a0704', font: 'Cormorant Garamond|Cormorant Garamond' },
  { n: 'Champagne',       accent: '#e8cd8f', bg: '#080703', font: 'Playfair Display|Inter' },
  { n: 'Bronze Age',      accent: '#c17a3e', bg: '#090502', font: 'Cinzel|Cormorant Garamond' },

  // ---- ROYAL / IMPERIAL ----
  { n: 'Royal Emerald',   accent: '#1fcf7a', bg: '#020a06', font: 'Space Grotesk|Inter' },
  { n: 'Ruby',            accent: '#d1284a', bg: '#0a0305', font: 'Playfair Display|Inter' },
  { n: 'Sapphire',        accent: '#3d5cff', bg: '#03050d', font: 'Space Grotesk|Inter' },
  { n: 'Amethyst',        accent: '#9040e0', bg: '#07040d', font: 'Cinzel|Cormorant Garamond' },
  { n: 'Imperial Purple', accent: '#8a3ffc', bg: '#06030b', font: 'Cinzel|Cormorant Garamond' },
  { n: 'Coronation',      accent: '#c9a02e', bg: '#0a0402', font: 'Cinzel|Cormorant Garamond' },
  { n: 'Venetian Crimson',accent: '#b91d3a', bg: '#0a0304', font: 'Playfair Display|Cormorant Garamond' },

  // ---- ANCIENT / MYTHIC ----
  { n: 'Pharaoh',         accent: '#d9b23c', bg: '#050803', font: 'Cinzel|Cormorant Garamond' },
  { n: 'Papyrus & Lapis', accent: '#2f6fb0', bg: '#07060a', font: 'Cinzel|Cormorant Garamond' },
  { n: 'Roman Marble',    accent: '#c7bda3', bg: '#08080a', font: 'Cormorant Garamond|Cormorant Garamond' },
  { n: 'Volcanic Onyx',   accent: '#e0522f', bg: '#050404', font: 'Cinzel|Inter' },

  // ---- PLATINUM / MODERN ----
  { n: 'Platinum',        accent: '#9fb2c4', bg: '#06090c', font: 'Inter|Inter' },
  { n: 'Titanium',        accent: '#8b98a5', bg: '#07090b', font: 'Inter|Inter' },
  { n: 'Neon Terminal',   accent: '#39ff8f', bg: '#040605', font: 'JetBrains Mono|Inter' },
  { n: 'Cyber Violet',    accent: '#b24bff', bg: '#05030b', font: 'JetBrains Mono|Inter' },

  // ---- TECH / CYBERPUNK ----
  { n: 'Neon Cyan',       accent: '#28e5ff', bg: '#020608', font: 'JetBrains Mono|Inter' },
  { n: 'Signal Red',      accent: '#ff3b4e', bg: '#050303', font: 'JetBrains Mono|Inter' },
  { n: 'Holo Chrome',     accent: '#b9f2ff', bg: '#04070a', font: 'Space Grotesk|Inter' },
  { n: 'Reactor Amber',   accent: '#ffb020', bg: '#060402', font: 'JetBrains Mono|Inter' },
  { n: 'Matrix Green',    accent: '#2bff6a', bg: '#020402', font: 'JetBrains Mono|Inter' },

  // ---- CINEMATIC ----
  { n: 'Film Noir',       accent: '#c9c9c9', bg: '#050505', font: 'Playfair Display|Inter' },
  { n: 'Neo-Tokyo Dusk',  accent: '#ff5fa2', bg: '#06030a', font: 'Space Grotesk|Inter' },
  { n: 'Desert Western',  accent: '#d98a3d', bg: '#0a0703', font: 'Playfair Display|Cormorant Garamond' },
  { n: 'Blade Runner',    accent: '#ff7a2e', bg: '#030507', font: 'Space Grotesk|Inter' },
  { n: 'Midnight Heist',  accent: '#4a6fa5', bg: '#040609', font: 'Playfair Display|Inter' },
  { n: 'Gothic Horror',   accent: '#8a1f2b', bg: '#040203', font: 'Cinzel|Cormorant Garamond' },

  // ---- NATURE / ELEMENTAL ----
  { n: 'Deep Ocean',      accent: '#1fa8c9', bg: '#020609', font: 'Space Grotesk|Inter' },
  { n: 'Glacier Ice',     accent: '#a8e8f0', bg: '#040a0d', font: 'Inter|Inter' },
  { n: 'Ember Forest',    accent: '#ff6b35', bg: '#050502', font: 'Cinzel|Inter' },
  { n: 'Midnight Jade',   accent: '#3ecf8e', bg: '#030805', font: 'Cormorant Garamond|Cormorant Garamond' },
  { n: 'Solar Flare',     accent: '#ff8c3d', bg: '#080402', font: 'Space Grotesk|Inter' },
];

export const ACCENTS = PRESETS.map((p) => p.accent);
export const BACKGROUNDS = PRESETS.map((p) => p.bg);
export const FONTS = [
  { label: 'Space Grotesk · Inter', tag: 'Instrument', v: 'Space Grotesk|Inter' },
  { label: 'Inter · Inter', tag: 'Product', v: 'Inter|Inter' },
  { label: 'JetBrains Mono · Inter', tag: 'Terminal', v: 'JetBrains Mono|Inter' },
  { label: 'Playfair Display · Inter', tag: 'Editorial', v: 'Playfair Display|Inter' },
  { label: 'Cinzel · Cormorant Garamond', tag: 'Royal', v: 'Cinzel|Cormorant Garamond' },
  { label: 'Cormorant Garamond', tag: 'Classic serif', v: 'Cormorant Garamond|Cormorant Garamond' },
  { label: 'Playfair Display · Cormorant Garamond', tag: 'Manuscript', v: 'Playfair Display|Cormorant Garamond' },
  { label: 'Cinzel · Inter', tag: 'Monument', v: 'Cinzel|Inter' },
  { label: 'Space Grotesk · Space Grotesk', tag: 'Cyberpunk', v: 'Space Grotesk|Space Grotesk' },
  { label: 'JetBrains Mono · JetBrains Mono', tag: 'Full Terminal', v: 'JetBrains Mono|JetBrains Mono' },
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

/** Apply a whole theme object { accent, bg, font, preset } */
export function applyTheme(t) {
  if (!t) return;
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
  setTheme({ preset: i, accent: p.accent, bg: p.bg, font: p.font });
}

/* ---------- studio UI state sync ---------- */
function syncStudio(t) {
  document.querySelectorAll('.preset').forEach((el, i) => el.classList.toggle('on', i === t.preset));
  document.querySelectorAll('#sw-accent .swatch').forEach((el) => el.classList.toggle('on', el.dataset.v === t.accent));
  document.querySelectorAll('#sw-bg .swatch').forEach((el) => el.classList.toggle('on', el.dataset.v === t.bg));
  document.querySelectorAll('#font-opts .font-opt').forEach((el) => el.classList.toggle('on', el.dataset.v === t.font));
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

  syncStudio(state.config.theme);
}