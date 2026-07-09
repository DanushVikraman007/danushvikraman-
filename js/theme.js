/* ============================================================
   THEME ENGINE — rewrites the token layer at runtime.
   Every surface, glow, particle and the atom read the same
   CSS variables, so one call restyles the entire system.
   ============================================================ */
import { state, emitChange } from './state.js';

/* ============================================================
   THEME FAMILIES
   Each family is ONE identity (a metal or gem) that works as
   both a dark and a light theme. The accent hue is shared —
   only its lightness/saturation is tuned per mode so it reads
   clearly on near-black AND near-white. The font pairing stays
   constant across modes so switching mode never breaks branding.
   ============================================================ */
export const FAMILIES = [
  {
    id: 'gold', n: 'Imperial Gold', font: 'Cinzel|Cormorant Garamond',
    dark:  { accent: '#d4a84c', bg: '#08070a' },
    light: { accent: '#8a6a1f', bg: '#f8f4e9' },
  },
  {
    id: 'platinum', n: 'Platinum', font: 'Playfair Display|Inter',
    dark:  { accent: '#c9d4e0', bg: '#08090a' },
    light: { accent: '#5b6b7a', bg: '#f4f5f7' },
  },
  {
    id: 'silver', n: 'Liquid Mercury', font: 'Space Grotesk|Inter',
    dark:  { accent: '#c9d4e0', bg: '#060708' },
    light: { accent: '#5c6b7a', bg: '#f6f7f8' },
  },
  {
    id: 'sapphire', n: 'Royal Sapphire', font: 'Cinzel|Cormorant Garamond',
    dark:  { accent: '#3a5bd6', bg: '#040610' },
    light: { accent: '#22349e', bg: '#f0f2fb' },
  },
  {
    id: 'cobalt', n: 'Cobalt', font: 'Space Grotesk|Inter',
    dark:  { accent: '#4a72e0', bg: '#03050d' },
    light: { accent: '#2848b8', bg: '#eef1fb' },
  },
  {
    id: 'emerald', n: 'Royal Emerald', font: 'Cinzel|Cormorant Garamond',
    dark:  { accent: '#22a868', bg: '#020a06' },
    light: { accent: '#146b3f', bg: '#f0f7f2' },
  },
  {
    id: 'jade', n: 'Midnight Jade', font: 'Space Grotesk|Inter',
    dark:  { accent: '#2fae87', bg: '#03080a' },
    light: { accent: '#187a5c', bg: '#eef8f4' },
  },
  {
    id: 'ruby', n: 'Ruby', font: 'Playfair Display|Inter',
    dark:  { accent: '#e0355e', bg: '#0a0305' },
    light: { accent: '#a3163d', bg: '#faf0f2' },
  },
  {
    id: 'crimson', n: 'Crimson', font: 'Cinzel|Cormorant Garamond',
    dark:  { accent: '#d1425a', bg: '#0a0304' },
    light: { accent: '#9c1f34', bg: '#faf0f1' },
  },
  {
    id: 'garnet', n: 'Garnet', font: 'Cormorant Garamond|Cormorant Garamond',
    dark:  { accent: '#c0526a', bg: '#080304' },
    light: { accent: '#8f1330', bg: '#f8eff0' },
  },
  {
    id: 'wine', n: 'Wine', font: 'Cinzel|Cormorant Garamond',
    dark:  { accent: '#b3506c', bg: '#070304' },
    light: { accent: '#7a1f3d', bg: '#f8eff1' },
  },
  {
    id: 'amethyst', n: 'Royal Amethyst', font: 'Cinzel|Cormorant Garamond',
    dark:  { accent: '#9b6ae0', bg: '#06030d' },
    light: { accent: '#6d3fc4', bg: '#f4f1fa' },
  },
  {
    id: 'quartz', n: 'Lilac Quartz', font: 'Cormorant Garamond|Cormorant Garamond',
    dark:  { accent: '#a688e0', bg: '#07040d' },
    light: { accent: '#7d5bc0', bg: '#f6f3fb' },
  },
  {
    id: 'aqua', n: 'Royal Aqua', font: 'Cinzel|Cormorant Garamond',
    dark:  { accent: '#2ecfe0', bg: '#020809' },
    light: { accent: '#0e879a', bg: '#eef7f8' },
  },
  {
    id: 'peacock', n: 'Peacock', font: 'Cinzel|Cormorant Garamond',
    dark:  { accent: '#28b8b0', bg: '#020808' },
    light: { accent: '#0e7d78', bg: '#eef7f6' },
  },
  {
    id: 'topaz', n: 'Topaz', font: 'Playfair Display|Inter',
    dark:  { accent: '#f0a83c', bg: '#0a0602' },
    light: { accent: '#a86a15', bg: '#f8f2e8' },
  },
  {
    id: 'bronze', n: 'Bronze', font: 'Cormorant Garamond|Cormorant Garamond',
    dark:  { accent: '#c98f52', bg: '#040404' },
    light: { accent: '#8f5c26', bg: '#f7f2ea' },
  },
  {
    id: 'rosegold', n: 'Royal Rose Gold', font: 'Playfair Display|Inter',
    dark:  { accent: '#e0a48c', bg: '#0a0503' },
    light: { accent: '#a85f42', bg: '#f8efe9' },
  },
  {
    id: 'molten', n: 'Molten', font: 'Space Grotesk|Inter',
    dark:  { accent: '#ff8f3d', bg: '#0b0503' },
    light: { accent: '#c4600f', bg: '#f8efe6' },
  },
  {
    id: 'graphite', n: 'Graphite', font: 'JetBrains Mono|Inter',
    dark:  { accent: '#9a9a9a', bg: '#060606' },
    light: { accent: '#4a4a4a', bg: '#f5f5f4' },
  },
  {
    id: 'onyx', n: 'Onyx & Pearl', font: 'Inter|Inter',
    dark:  { accent: '#dcdfe6', bg: '#050506' },
    light: { accent: '#2c2c2c', bg: '#f5f5f4' },
  },
];

/* ============================================================
   EXCLUSIVE FAMILIES — single-mode, high-contrast signature looks.
   Unlike FAMILIES above, each of these is built for ONE mode only:
   the accent/bg pairing is tuned so hard (near-pure black or white
   as the *accent*, not just the background) that it would lose all
   contrast if flipped. No `dark`/`light` variant object — just one
   `slot` telling the studio which mode list it belongs in. These are
   the "house exclusives": treat them as a premium tier above the
   regular paired families, reserved for people who want the most
   dramatic, editorial, black-tie version of the palette.
   ============================================================ */
export const EXCLUSIVES = [
  {
    id: 'blackonwhite', n: 'Noir Blanc', font: 'Cinzel|Cormorant Garamond',
    slot: 'light', accent: '#0a0a0a', bg: '#fbfaf7',
    tagline: 'Ink on ivory — the house exclusive light signature.',
  },
  {
    id: 'inkpaper', n: 'Ink & Cotton', font: 'Playfair Display|Inter',
    slot: 'light', accent: '#111214', bg: '#f9f7f2',
    tagline: 'Letterpress black on cotton paper.',
  },
  {
    id: 'obsidianpearl', n: 'Obsidian on Pearl', font: 'Cormorant Garamond|Cormorant Garamond',
    slot: 'light', accent: '#0d0d0f', bg: '#f6f4ef',
    tagline: 'Polished black stone set in pearl.',
  },
  {
    id: 'marbleslate', n: 'Marble & Slate', font: 'Playfair Display|Inter',
    slot: 'light', accent: '#161616', bg: '#f7f6f3',
    tagline: 'Carved slate lettering on white marble.',
  },
  {
    id: 'whiteongold', n: 'Blanc Royale', font: 'Cinzel|Cormorant Garamond',
    slot: 'light', accent: '#7a5a12', bg: '#fffdf8',
    tagline: 'Gold leaf on porcelain white — the gilded exclusive.',
  },
  {
    id: 'porcelain', n: 'Porcelain Noir', font: 'Inter|Inter',
    slot: 'light', accent: '#000000', bg: '#fcfcfa',
    tagline: 'Pure black on pure porcelain, no warmth, no compromise.',
  },
  {
    id: 'whiteonblack', n: 'Blanc Noir', font: 'Cinzel|Cormorant Garamond',
    slot: 'dark', accent: '#fbfaf7', bg: '#050505',
    tagline: 'Ivory on the void — the house exclusive dark signature.',
  },
  {
    id: 'moonvoid', n: 'Moonlight Void', font: 'Playfair Display|Inter',
    slot: 'dark', accent: '#f4f2ec', bg: '#030303',
    tagline: 'Full moon white against true-black night.',
  },
  {
    id: 'pearlonyx', n: 'Pearl on Onyx', font: 'Cormorant Garamond|Cormorant Garamond',
    slot: 'dark', accent: '#f2efe9', bg: '#040404',
    tagline: 'Pearl inlay on polished onyx.',
  },
  {
    id: 'chromevoid', n: 'Chrome Void', font: 'Space Grotesk|Inter',
    slot: 'dark', accent: '#e8ecf0', bg: '#000000',
    tagline: 'Mirror chrome floating in absolute black.',
  },
  {
    id: 'goldonblack', n: 'Noir Royale', font: 'Cinzel|Cormorant Garamond',
    slot: 'dark', accent: '#e8c974', bg: '#020202',
    tagline: 'Gold leaf on jet black — the gilded dark exclusive.',
  },
  {
    id: 'platinumvoid', n: 'Platinum Void', font: 'Inter|Inter',
    slot: 'dark', accent: '#ffffff', bg: '#000000',
    tagline: 'Maximum contrast: pure white on pure black.',
  },

  /* -------- Jewel exclusives --------
     Same "single-mode, no compromise" philosophy as the black/white
     exclusives above, but built around saturated gemstone accents
     instead of neutrals. Where FAMILIES tones ruby/sapphire/emerald
     down so one hue works in both modes, these push the SAME gems
     further in one direction only — deeper, richer, more saturated —
     and pair them with a tinted (not neutral) background so the
     whole look reads as one jewel-toned surface, not just "a color on
     black". Six for dark (gem glowing out of a near-black backdrop of
     its own hue), six for light (gem ink on a pale wash of itself). */
  {
    id: 'rubyvoid', n: 'Ruby Imperial', font: 'Playfair Display|Inter',
    slot: 'dark', accent: '#ff2f5f', bg: '#0a0106',
    tagline: 'Blood-ruby glow on a near-black garnet backdrop.',
  },
  {
    id: 'sapphirevoid', n: 'Sapphire Imperial', font: 'Cinzel|Cormorant Garamond',
    slot: 'dark', accent: '#3d5cff', bg: '#03040f',
    tagline: 'Deep sapphire fire against midnight blue-black.',
  },
  {
    id: 'emeraldvoid', n: 'Emerald Imperial', font: 'Cinzel|Cormorant Garamond',
    slot: 'dark', accent: '#12d97a', bg: '#020a05',
    tagline: 'Emerald brilliance cut against forest-black.',
  },
  {
    id: 'amethystvoid', n: 'Amethyst Imperial', font: 'Cinzel|Cormorant Garamond',
    slot: 'dark', accent: '#a855ff', bg: '#08020f',
    tagline: 'Violet fire on a near-black amethyst ground.',
  },
  {
    id: 'topazvoid', n: 'Topaz Imperial', font: 'Playfair Display|Inter',
    slot: 'dark', accent: '#ffb020', bg: '#0a0500',
    tagline: 'Molten topaz glow against charred amber-black.',
  },
  {
    id: 'aquavoid', n: 'Aquamarine Imperial', font: 'Cinzel|Cormorant Garamond',
    slot: 'dark', accent: '#1de3e8', bg: '#010a0a',
    tagline: 'Electric aquamarine against deep sea-black.',
  },
  {
    id: 'rubypaper', n: 'Ruby on Ivory', font: 'Playfair Display|Inter',
    slot: 'light', accent: '#b8123f', bg: '#fdf2f4',
    tagline: 'Ruby ink on the palest rose-ivory.',
  },
  {
    id: 'sapphirepaper', n: 'Sapphire on Ivory', font: 'Cinzel|Cormorant Garamond',
    slot: 'light', accent: '#1b34b8', bg: '#f1f3fc',
    tagline: 'Sapphire ink on a whisper of periwinkle.',
  },
  {
    id: 'emeraldpaper', n: 'Emerald on Ivory', font: 'Cinzel|Cormorant Garamond',
    slot: 'light', accent: '#0d7a42', bg: '#eff9f3',
    tagline: 'Emerald ink on the palest mint wash.',
  },
  {
    id: 'amethystpaper', n: 'Amethyst on Ivory', font: 'Cinzel|Cormorant Garamond',
    slot: 'light', accent: '#7222c4', bg: '#f6f0fc',
    tagline: 'Amethyst ink on a whisper of lilac.',
  },
  {
    id: 'topazpaper', n: 'Topaz on Ivory', font: 'Playfair Display|Inter',
    slot: 'light', accent: '#b8720f', bg: '#fdf6ea',
    tagline: 'Topaz ink on a warm honey wash.',
  },
  {
    id: 'aquapaper', n: 'Aquamarine on Ivory', font: 'Cinzel|Cormorant Garamond',
    slot: 'light', accent: '#0d8f96', bg: '#eefaf9',
    tagline: 'Aquamarine ink on the palest sea-glass wash.',
  },
];

export function getExclusive(id) {
  return EXCLUSIVES.find((e) => e.id === id) || null;
}
export function exclusivesFor(mode) {
  const slot = mode === 'light' ? 'light' : 'dark';
  return EXCLUSIVES.filter((e) => e.slot === slot);
}

/** Flattened, backward-compatible preset list.
 *  Each family contributes a dark entry then a light entry,
 *  both sharing the same base name so pairing stays obvious. */
export const PRESETS = FAMILIES.flatMap((f) => [
  { n: f.n, familyId: f.id, accent: f.dark.accent, bg: f.dark.bg, font: f.font, mode: 'dark' },
  { n: f.n, familyId: f.id, accent: f.light.accent, bg: f.light.bg, font: f.font, mode: 'light' },
]);

/** Exclusive presets, appended after the regular paired presets.
 *  Each one is single-mode (no opposite-mode partner), so it carries
 *  its own `mode` and no `familyId` toggle counterpart exists for it —
 *  toggling mode from an exclusive falls back to the nearest regular
 *  family (see toggleFamilyMode below). */
export const EXCLUSIVE_PRESETS = EXCLUSIVES.map((e) => ({
  n: e.n, exclusiveId: e.id, accent: e.accent, bg: e.bg, font: e.font, mode: e.slot, exclusive: true,
}));

/** Look up a family by id */
export function getFamily(id) {
  return FAMILIES.find((f) => f.id === id) || null;
}

/** Flip the *current* theme's mode. If the active theme is a regular
 *  paired family, stay in that family and swap to its other mode
 *  (unchanged behavior). If the active theme is a single-mode
 *  EXCLUSIVE, there's no opposite-mode variant of the *same* look by
 *  design — so this jumps to the closest regular family instead,
 *  keeping the font pairing constant so the switch feels intentional
 *  rather than jarring. */
export function toggleFamilyMode() {
  const t = state.config.theme;
  if (t.exclusiveId) {
    const nextMode = t.mode === 'light' ? 'dark' : 'light';
    const fallback = FAMILIES.find((f) => f.font === t.font) || FAMILIES[0];
    const variant = fallback[nextMode];
    setTheme({ familyId: fallback.id, exclusiveId: null, accent: variant.accent, bg: variant.bg, font: fallback.font, mode: nextMode, preset: -1 });
    return;
  }
  const fam = getFamily(t.familyId) || FAMILIES[0];
  const nextMode = t.mode === 'light' ? 'dark' : 'light';
  const variant = fam[nextMode];
  setTheme({ familyId: fam.id, exclusiveId: null, accent: variant.accent, bg: variant.bg, font: fam.font, mode: nextMode, preset: -1 });
}

/** Apply an exclusive by id (single-mode, so this also forces the
 *  studio into that mode — an exclusive can't be viewed "flipped"). */
export function applyExclusive(id) {
  const e = getExclusive(id);
  if (!e) return;
  setTheme({ exclusiveId: e.id, familyId: null, preset: -1, accent: e.accent, bg: e.bg, font: e.font, mode: e.slot });
}

/* Mode-aware swatch lists, derived straight from FAMILIES so every
   accent/background offered in the studio is guaranteed to belong
   to a real paired theme and to have been tuned for that mode. */
export const ACCENTS_DARK = FAMILIES.map((f) => f.dark.accent);
export const ACCENTS_LIGHT = FAMILIES.map((f) => f.light.accent);
export const BACKGROUNDS_DARK = FAMILIES.map((f) => f.dark.bg);
export const BACKGROUNDS_LIGHT = FAMILIES.map((f) => f.light.bg);

export function accentsFor(mode) {
  return mode === 'light' ? ACCENTS_LIGHT : ACCENTS_DARK;
}
export function backgroundsFor(mode) {
  return mode === 'light' ? BACKGROUNDS_LIGHT : BACKGROUNDS_DARK;
}

/* Back-compat flat exports (dark-biased, matches previous default) */
export const ACCENTS = ACCENTS_DARK;
export const BACKGROUNDS = BACKGROUNDS_DARK;
export const FONTS = [
  { label: 'Space Grotesk · Inter', tag: 'Instrument', v: 'Space Grotesk|Inter' },
  { label: 'Inter · Inter', tag: 'Product', v: 'Inter|Inter' },
  { label: 'JetBrains Mono · Inter', tag: 'Terminal', v: 'JetBrains Mono|Inter' },
  { label: 'Playfair Display · Inter', tag: 'Editorial', v: 'Playfair Display|Inter' },
  { label: 'Cinzel · Cormorant Garamond', tag: 'Royal', v: 'Cinzel|Cormorant Garamond' },
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
  const isLight = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) > 150;
  const step = isLight ? -7 : 7;
  const r = document.documentElement.style;
  r.setProperty('--bg', hex);
  r.setProperty('--bg-1', toHex(lift(rgb, step)));
  r.setProperty('--bg-2', toHex(lift(rgb, step * 2)));
  r.setProperty('--bg-3', toHex(lift(rgb, step * 3)));
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
  setTheme({ preset: i, familyId: p.familyId, exclusiveId: null, accent: p.accent, bg: p.bg, font: p.font, mode: p.mode });
}

/** Custom accent/bg picks stay paired to the active family's OTHER
 *  mode when possible, so a manual tweak still round-trips cleanly
 *  if the user later toggles light/dark. */
function pickCustom(key, value) {
  setTheme({ [key]: value, preset: -1 });
}

/* ---------- studio UI state sync ---------- */
function syncStudio(t) {
  const mode = t.mode || 'dark';
  document.querySelectorAll('.preset').forEach((el, i) => el.classList.toggle('on', i === t.preset));
  document.querySelectorAll('.preset-exclusive').forEach((el) => el.classList.toggle('on', el.dataset.id === t.exclusiveId));
  document.querySelectorAll('#sw-accent .swatch').forEach((el) => el.classList.toggle('on', el.dataset.v === t.accent));
  document.querySelectorAll('#sw-bg .swatch').forEach((el) => el.classList.toggle('on', el.dataset.v === t.bg));
  document.querySelectorAll('#font-opts .font-opt').forEach((el) => el.classList.toggle('on', el.dataset.v === t.font));
  document.querySelectorAll('#mode-toggle .font-opt').forEach((el) => el.classList.toggle('on', el.dataset.v === mode));
}

/* ---------- build studio controls ---------- */
export function buildStudio() {
  const presets = document.getElementById('presets');
  presets.innerHTML = '';
  PRESETS.forEach((p, i) => {
    const el = document.createElement('button');
    el.className = 'preset';
    el.type = 'button';
    el.title = `${p.n} · ${p.mode === 'light' ? 'Light' : 'Dark'}`;
    el.style.background = `linear-gradient(135deg, ${p.bg}, ${p.accent}88, ${p.accent})`;
    el.innerHTML = `<span>${p.n}</span><small>${p.mode === 'light' ? '○ Light' : '● Dark'}</small>`;
    el.addEventListener('click', () => applyPreset(i));
    presets.appendChild(el);
  });

  // Exclusives render in their own strip, filtered to the current mode,
  // so the grid never shows a look that won't work against the active bg.
  buildExclusives();

  rebuildSwatches();

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
    el.addEventListener('click', () => {
      if (state.config.theme.familyId || state.config.theme.exclusiveId) {
        // Stay in the same family, just flip mode — keeps colors coherent.
        toggleFamilyMode();
      } else {
        setTheme({ mode: v, preset: -1 });
      }
      rebuildSwatches();
      buildExclusives();
    });
    modes.appendChild(el);
  });

  syncStudio(state.config.theme);
}

/** Build/refresh the "Exclusives" strip — premium, single-mode-only
 *  looks (near-black-on-white for light, near-white-on-black for dark).
 *  Only ever shows the set matching the CURRENT mode; there is no
 *  "wrong mode" exclusive on screen to accidentally pick. */
function buildExclusives() {
  const box = document.getElementById('presets-exclusive');
  if (!box) return; // host page may not have this section — safe no-op
  box.innerHTML = '';
  const mode = state.config.theme.mode || 'dark';
  exclusivesFor(mode).forEach((e) => {
    const el = document.createElement('button');
    el.className = 'preset preset-exclusive';
    el.type = 'button';
    el.dataset.id = e.id;
    el.title = e.tagline || e.n;
    el.style.background = `linear-gradient(135deg, ${e.bg}, ${e.accent}aa, ${e.accent})`;
    el.innerHTML = `<span>${e.n}</span><small>★ Exclusive</small>`;
    el.addEventListener('click', () => applyExclusive(e.id));
    box.appendChild(el);
  });
}

/** Rebuild the accent/bg swatch grids for the CURRENT mode so every
 *  swatch offered is guaranteed legible against the active bg. */
function rebuildSwatches() {
  const mode = state.config.theme.mode || 'dark';

  const mkSwatches = (id, values, key) => {
    const box = document.getElementById(id);
    if (!box) return;
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
      el.addEventListener('click', () => pickCustom(key, v));
      box.appendChild(el);
    });
  };
  mkSwatches('sw-accent', accentsFor(mode), 'accent');
  mkSwatches('sw-bg', backgroundsFor(mode), 'bg');
}
