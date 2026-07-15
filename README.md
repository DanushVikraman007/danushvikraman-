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
  state.js            ← config store, local cache, stable item IDs
  render.js           ← JSON → DOM
  theme.js            ← presets, accent/bg/font/mode engine
  atom.js             ← the signature 3D atom
  particles.js        ← ambient background field
  admin.js            ← passcode auth, inline editing, admin console
  github.js           ← one-click publish to your repo
  resume.js           ← Résumé Mode: card selection + PDF preview
  resume-latex.js     ← config → resume.json → LaTeX (pure, testable)
resume/
  resume-template.tex ← the canonical résumé design (safe to edit)
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

## 5 · Résumé Mode — generate a PDF résumé from the same content

The site can build a one-page LaTeX résumé straight from your portfolio, so the résumé and the site never drift apart. It's tucked **inside edit mode**, so visitors never see it.

**How to use it**

1. Click **✎** and unlock edit mode (your passcode).
2. In the bottom bar, click **Résumé**. The bar switches to Résumé Mode.
3. Browse into any section. Each card grows an **“Include in résumé”** checkbox — tick the ones you want. Home-grid cards show a running `n/… selected` tally; the contact card shows `→ header` (it fills the name/phone/email/links line automatically, so there's nothing to tick there).
4. Click **Generate PDF**. It compiles and shows a live preview with:
   - **Download PDF** — saves `SB_Danush_Vikraman_Resume.pdf`.
   - **Print** — prints the PDF directly.
   - **.tex** / **resume.json** — the LaTeX source and the intermediate data, if you want them (e.g. to finish in Overleaf).
   - **Tighter spacing** — a compact recompile that squeezes borderline content back onto one page.
5. Click **Done** to leave Résumé Mode. Leaving edit mode always leaves Résumé Mode too.

Everything ships pre-ticked to reproduce your current résumé — so the very first **Generate PDF** already gives you the full document, and you subtract rather than build from scratch.

**How it works (for future you)**

- **Selection is by stable ID, not by content.** Each card gets a deterministic `_id` (in `state.js`). Résumé Mode stores only a list of those IDs in `site-config.json` → `resume.selectedItems`. Nothing is duplicated, reordering a section can't scramble your picks, and deleting a card quietly drops it from the résumé.
- **Because the selection lives in `site-config.json`, Publish carries it across devices** — same as the rest of your content.
- The pipeline is: `site-config.json` → `resume.json` (normalized) → `resume/resume-template.tex` → **pdflatex** → PDF. The template is the single source of visual truth; edit it to restyle the résumé. All portfolio text is LaTeX-escaped before it's inserted, so special characters (`& % $ _ ^`, maths symbols, accents) can't break a compile.
- **Compilation runs on [texlive.net](https://texlive.net)** (the LaTeX Project's public compile service — the same one learnlatex.org uses). There is **no résumé server of your own to run or secure**: the template is fixed in the repo and every value is escaped, so nothing arbitrary is ever sent. Your résumé's text *is* sent to texlive.net to be turned into a PDF — that's disclosed right in the preview. If it's ever unreachable, download the **.tex** and compile it in Overleaf or locally; the output is identical.

**One honest security note.** The passcode gate is **client-side** — it hides edit and résumé controls in the browser, which is the right model for a static GitHub Pages site (there is no server that could enforce anything, and none of these controls grant any privileged capability). Your write access to the repo is protected by your **GitHub token**, which never leaves your browser's localStorage. Treat the passcode as “keep the buttons out of visitors' way,” not as a server-side lock.
