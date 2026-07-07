# Danush Vikraman — Quantum Instrument OS Portfolio

A modular, JSON-driven portfolio. Every word on the site lives in **`site-config.json`** — the HTML/CSS/JS never needs touching to change content.

```
index.html            ← shell only (no content inside)
site-config.json      ← ALL content + theme + passcode hash
css/
  tokens.css          ← design tokens (the theme engine rewrites these live)
  base.css            ← layout, hero, atom instrument
  components.css      ← module cards & section renderers
  admin.css           ← edit mode, admin console, theme studio
js/
  main.js             ← boot + navigation
  state.js            ← config store, local cache
  render.js           ← JSON → DOM
  theme.js            ← presets, accent/bg/font/mode engine
  atom.js             ← the signature 3D atom
  particles.js        ← ambient background field
  admin.js            ← passcode auth, inline editing, admin console
  github.js           ← one-click publish to your repo
```

---

## 1 · Setup (once, ~5 minutes)

1. Go to your repo **github.com/DanushVikraman007/danushvikraman-** (or create a new one).
2. Upload **all files and folders** exactly as they are (keep the `css/` and `js/` folder structure). Delete the old single-file site.
3. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
4. Wait ~1 minute. Your site is live at `https://danushvikraman007.github.io/danushvikraman-/`.

> **Different repo name?** Edit the three `<meta name="github-…">` tags at the top of `index.html` to match, and the `meta.github` block in `site-config.json`.

> **Previewing locally?** Don't double-click `index.html` (ES modules can't load over `file://`). Instead run `python3 -m http.server` in the folder and open `http://localhost:8000`.

## 2 · Editing (whenever you want)

1. On the live site, click **✎** (top right).
2. **First time:** you'll be asked to create a passcode (min 6 chars). Only a salted PBKDF2 hash is stored — inside `site-config.json` — so after you publish once, the same passcode protects edit mode on **every** device.
3. In edit mode:
   - **Click any text** on the page and type — name, quote, bullets, titles, everything is editable in place.
   - **Console** (bottom bar, or ⌘ button) → the admin dashboard: add / edit / hide / delete / duplicate / reorder modules and their items. Drag ⠿ or use ↑↓.
   - **◐ Theme studio** → 12 presets, custom accent/background swatches, font pairs, dark (OLED) / light (frost) mode.
4. **Publish** (bottom bar) → commits `site-config.json` to your repo. Live for everyone in ~1 minute.

## 3 · Publishing — two ways

**A. One-click (recommended).** In the Console → **GitHub**, paste a fine-grained personal access token:
- github.com → Settings → Developer settings → Fine-grained tokens → Generate
- Repository access: *only* this repo · Permissions: **Contents → Read and write**
- The token is stored **only in your browser's localStorage** — it is never uploaded or committed. You'll paste it once per device.

**B. No token.** Console → **Export JSON** downloads `site-config.json`; commit it to the repo yourself (GitHub web UI → upload file → replace). Identical result.

Unpublished edits are always cached in the browser you made them in, so nothing is lost if you close the tab.

## 4 · Common tweaks

| Want to… | Do this |
|---|---|
| Fix the arXiv `#` placeholder links | Edit mode → Console → *Research & Projects* → ▤ → ✎ an item → Links field (`Label \| https://…`) |
| Change passcode | Console → **Passcode** |
| Hide a section temporarily | Console → 👁 (it stays in the file, invisible to visitors) |
| Add a brand-new page | Console → **＋ Module** (type `custom` gives you a free-text page; other types give structured editors) |
| Gradient word in a headline | Wrap it in pipes: `Research \|& projects\|` |
| Lost your passcode | Edit `site-config.json` in the repo: set `"passHash": null`, commit — next ✎ click asks for a new one |
