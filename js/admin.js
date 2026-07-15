/* ============================================================
   ADMIN — authentication, edit mode, the admin console, and
   structured editors. All edits mutate the config object; the
   renderer redraws from it. Nothing edits HTML directly.

   Security model:
   • Passcode is never stored — a PBKDF2-SHA256 hash (210k
     iterations, random salt) lives in site-config.json, so the
     lock syncs to every device that loads the site.
   • The GitHub token is device-local (localStorage) and is
     never written into the config or the repo.
   ============================================================ */
import {
  state, emitChange, getPath, setPath, cacheConfig,
  sections, sectionIndex, moveSection, reorderSection,
  exportConfigFile, getToken, saveToken,
} from './state.js';
import { publishConfig } from './github.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let rerender = () => {};
export function onRerender(fn) { rerender = fn; }

/* ================= AUTH (PBKDF2 via WebCrypto) ================= */
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

async function derive(pass, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256
  );
  return toHex(bits);
}

export async function setPasscode(pass) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const iterations = 210000;
  state.config.passHash = { salt, iterations, hash: await derive(pass, salt, iterations) };
  emitChange();
}

export async function verifyPasscode(pass) {
  const p = state.config.passHash;
  if (!p?.hash) return false;
  return (await derive(pass, p.salt, p.iterations)) === p.hash;
}

/* ================= EDIT MODE ================= */
let editMode = false;
export const isEditMode = () => editMode;

export function enterEdit() {
  editMode = true;
  document.body.classList.add('edit-mode');
  document.querySelectorAll('.icon-btn[data-edit-toggle]').forEach((b) => b.classList.add('on'));
  document.dispatchEvent(new CustomEvent('qos:edit-enter'));
  bindEditables();
  rerender();
}
export function exitEdit() {
  editMode = false;
  document.body.classList.remove('edit-mode');
  document.querySelectorAll('.icon-btn[data-edit-toggle]').forEach((b) => b.classList.remove('on'));
  document.querySelectorAll('[data-path]').forEach((el) => (el.contentEditable = 'false'));
  $('theme-studio').classList.remove('open');
  document.dispatchEvent(new CustomEvent('qos:edit-exit'));
  rerender();
}

export function bindEditables() {
  if (!editMode) return;
  document.querySelectorAll('[data-path]').forEach((el) => {
    el.contentEditable = 'plaintext-only' in document.body ? 'plaintext-only' : 'true';
    if (el.dataset.rich) el.contentEditable = 'true';
    el.spellcheck = false;
  });
}

/* Inline edits write back to the config via the element's data-path */
document.addEventListener('focusout', (e) => {
  const el = e.target.closest?.('[data-path]');
  if (!el || !editMode) return;
  let value;
  if (el.dataset.rich === 'headline') {
    value = [...el.childNodes].map((n) =>
      n.nodeName === 'EM' ? `|${n.textContent}|` : n.textContent
    ).join('');
  } else {
    value = el.innerText.replace(/\n+$/, '');
  }
  if (getPath(state.config, el.dataset.path) !== value) {
    setPath(state.config, el.dataset.path, value);
    emitChange();
    setStatus('Edited — cached on this device');
  }
});

export function setStatus(msg, ok) {
  const el = $('edit-status');
  el.textContent = msg;
  el.classList.toggle('ok-msg', !!ok);
  clearTimeout(setStatus._t);
  setStatus._t = setTimeout(() => {
    el.textContent = 'Edit mode · click any text to amend';
    el.classList.remove('ok-msg');
  }, 5000);
}

/* ================= DYNAMIC SHEET (single reusable modal) ================= */
export function openSheet(html, wide) {
  const ov = $('dyn-overlay');
  ov.querySelector('.sheet').className = `sheet${wide ? ' wide' : ''}`;
  ov.querySelector('.sheet').innerHTML = html;
  ov.classList.add('open');
  const first = ov.querySelector('input,textarea,select,button.primary');
  setTimeout(() => first?.focus(), 60);
  return ov.querySelector('.sheet');
}
export function closeSheet() { $('dyn-overlay').classList.remove('open'); }

function confirmSheet(msg, onYes) {
  const sheet = openSheet(`
    <div class="sheet-crest">Confirm</div>
    <div class="sheet-title">Are you sure?</div>
    <p class="sheet-sub">${esc(msg)}</p>
    <div class="sheet-actions">
      <button class="btn quiet" data-x="no">Cancel</button>
      <button class="btn danger" data-x="yes">Delete</button>
    </div>`);
  sheet.querySelector('[data-x="no"]').onclick = closeSheet;
  sheet.querySelector('[data-x="yes"]').onclick = () => { closeSheet(); onYes(); };
}

/* ================= ITEM FIELD SCHEMAS ================= */
const SCHEMAS = {
  timeline: [
    { k: 'heading', label: 'Heading', t: 'text' },
    { k: 'org', label: 'Organisation / degree', t: 'text' },
    { k: 'period', label: 'Period', t: 'text' },
    { k: 'meta', label: 'Meta stats — one per line: Label | Value', t: 'pairs' },
    { k: 'bullets', label: 'Bullet points — one per line', t: 'lines' },
    { k: 'tags', label: 'Tags — comma separated', t: 'csv' },
  ],
  projects: [
    { k: 'tag', label: 'Tag line', t: 'text' },
    { k: 'title', label: 'Title', t: 'text' },
    { k: 'subtitle', label: 'Subtitle', t: 'text' },
    { k: 'description', label: 'Description', t: 'textarea' },
    { k: 'links', label: 'Links — one per line: Label | https://…', t: 'links' },
  ],
  skills: [
    { k: 'group', label: 'Group name', t: 'text' },
    { k: 'tags', label: 'Skills — comma separated', t: 'csv' },
  ],
  achievements: [
    { k: 'icon', label: 'Icon (emoji)', t: 'text' },
    { k: 'title', label: 'Title', t: 'text' },
    { k: 'description', label: 'Description', t: 'textarea' },
  ],
  contact: [
    { k: 'icon', label: 'Icon', t: 'text' },
    { k: 'label', label: 'Label', t: 'text' },
    { k: 'url', label: 'URL (mailto:, tel:, https:)', t: 'text' },
  ],
};

const encodeField = (f, v) => {
  if (v == null) return '';
  switch (f.t) {
    case 'lines': return v.join('\n');
    case 'csv': return v.join(', ');
    case 'pairs': return v.map((p) => `${p.k} | ${p.v}`).join('\n');
    case 'links': return v.map((l) => `${l.label} | ${l.url}`).join('\n');
    default: return v;
  }
};
const decodeField = (f, raw) => {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  switch (f.t) {
    case 'lines': return lines;
    case 'csv': return raw.split(',').map((s) => s.trim()).filter(Boolean);
    case 'pairs': return lines.map((l) => { const [k, ...r] = l.split('|'); return { k: k.trim(), v: r.join('|').trim() }; });
    case 'links': return lines.map((l) => { const [label, ...r] = l.split('|'); return { label: label.trim(), url: r.join('|').trim() }; });
    default: return raw.trim();
  }
};

const itemLabel = (type, it) =>
  it.title || it.heading || it.group || it.label || it.k || 'Untitled';

/* ================= ADMIN CONSOLE ================= */
export function openConsole() {
  const rows = sections().map((s) => `
    <div class="admin-row${s.hidden ? ' hidden-row' : ''}" draggable="true" data-id="${esc(s.id)}">
      <span class="grip" title="Drag to reorder">⠿</span>
      <div class="name"><b>${esc(s.title)}</b><span>${esc(s.numeral)} · ${esc(s.type)} · ${s.items?.length ?? 0} items</span></div>
      <button class="row-btn" data-act="up" title="Move up">↑</button>
      <button class="row-btn" data-act="down" title="Move down">↓</button>
      <button class="row-btn" data-act="vis" title="${s.hidden ? 'Publish' : 'Hide'}">${s.hidden ? '◌' : '👁'}</button>
      <button class="row-btn" data-act="meta" title="Edit module">✎</button>
      ${s.type === 'custom' ? '<button class="row-btn" data-act="body" title="Edit content">¶</button>' : `<button class="row-btn" data-act="items" title="Manage items">▤</button>`}
      <button class="row-btn danger" data-act="del" title="Delete">✕</button>
    </div>`).join('');

  const sheet = openSheet(`
    <div class="sheet-crest">Admin console</div>
    <div class="sheet-title">Site structure</div>
    <p class="sheet-sub">Drag ⠿ to reorder. Hidden modules stay in the file but don't render for visitors.</p>
    <div class="admin-list" id="admin-list">${rows}</div>
    <div class="sheet-actions" style="justify-content:space-between">
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="btn quiet" data-x="gh">GitHub</button>
        <button class="btn quiet" data-x="pass">Passcode</button>
        <button class="btn quiet" data-x="export">Export JSON</button>
      </div>
      <div style="display:flex;gap:.6rem">
        <button class="btn quiet" data-x="add">＋ Module</button>
        <button class="btn primary" data-x="done">Done</button>
      </div>
    </div>`, true);

  sheet.querySelector('[data-x="done"]').onclick = closeSheet;
  sheet.querySelector('[data-x="add"]').onclick = () => openSectionEditor(null);
  sheet.querySelector('[data-x="export"]').onclick = () => { exportConfigFile(); setStatus('site-config.json downloaded'); };
  sheet.querySelector('[data-x="gh"]').onclick = openGithubSheet;
  sheet.querySelector('[data-x="pass"]').onclick = () => openPassSheet(true);

  const list = sheet.querySelector('#admin-list');
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-btn');
    if (!btn) return;
    const id = btn.closest('.admin-row').dataset.id;
    const s = sections().find((x) => x.id === id);
    const act = btn.dataset.act;
    if (act === 'up' || act === 'down') { moveSection(id, act === 'up' ? -1 : 1); openConsole(); }
    if (act === 'vis') { s.hidden = !s.hidden; emitChange(); openConsole(); }
    if (act === 'meta') openSectionEditor(id);
    if (act === 'items') openItemList(id);
    if (act === 'body') openSectionEditor(id);
    if (act === 'del') confirmSheet(`Delete the "${s.title}" module and all of its content? This cannot be undone after publishing.`, () => {
      sections().splice(sectionIndex(id), 1);
      emitChange();
      openConsole();
    });
  });

  // drag & drop reorder
  let draggedId = null;
  list.querySelectorAll('.admin-row').forEach((row) => {
    row.addEventListener('dragstart', () => { draggedId = row.dataset.id; row.classList.add('dragging'); });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedId && draggedId !== row.dataset.id) { reorderSection(draggedId, row.dataset.id); openConsole(); }
    });
  });
}

/* ================= SECTION (MODULE) EDITOR ================= */
const NUMERALS = [
  'I', 'II', 'III', 'IV', 'V',
  'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV',
  'XVI', 'XVII', 'XVIII', 'XIX', 'XX'
];

function openSectionEditor(id) {
  const isNew = !id;
  const s = isNew
    ? { id: '', type: 'custom', numeral: NUMERALS[Math.min(sections().length, NUMERALS.length - 1)], category: 'Chapter', title: '', subtitle: '', overline: '', headline: '', body: '', link: { label: '', url: '' }, hidden: false, items: [] }
    : sections().find((x) => x.id === id);

  const typeOpts = ['custom', 'timeline', 'projects', 'skills', 'achievements', 'contact']
    .map((t) => `<option value="${t}" ${s.type === t ? 'selected' : ''}>${t}</option>`).join('');

  const sheet = openSheet(`
    <div class="sheet-crest">${isNew ? 'New module' : 'Edit module'}</div>
    <div class="sheet-title">${isNew ? 'Add module' : esc(s.title)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
      <div><label class="field-label">Numeral</label>
        <select class="field" data-f="numeral">${NUMERALS.map((n) => `<option ${n === s.numeral ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label class="field-label">Type ${isNew ? '' : '(fixed)'}</label>
        <select class="field" data-f="type" ${isNew ? '' : 'disabled'}>${typeOpts}</select></div>
    </div>
    <label class="field-label">Category label</label><input class="field" data-f="category" value="${esc(s.category)}">
    <label class="field-label">Title</label><input class="field" data-f="title" value="${esc(s.title)}">
    <label class="field-label">Card subtitle</label><input class="field" data-f="subtitle" value="${esc(s.subtitle)}">
    <label class="field-label">Overline</label><input class="field" data-f="overline" value="${esc(s.overline || '')}">
    <label class="field-label">Headline — wrap the gradient word in |pipes|</label>
    <input class="field" data-f="headline" value="${esc(s.headline || '')}" placeholder="Research |& projects|">
    <div data-custom-only style="${s.type === 'custom' || isNew ? '' : 'display:none'}">
      <label class="field-label">Body text</label><textarea class="field" data-f="body">${esc(s.body || '')}</textarea>
      <label class="field-label">Link — Label | https://…</label>
      <input class="field" data-f="link" value="${esc(s.link?.url ? `${s.link.label} | ${s.link.url}` : '')}">
    </div>
    <p class="err" id="sec-err"></p>
    <div class="sheet-actions">
      <button class="btn quiet" data-x="back">Cancel</button>
      <button class="btn primary" data-x="save">${isNew ? 'Add module' : 'Save module'}</button>
    </div>`, true);

  const typeSel = sheet.querySelector('[data-f="type"]');
  typeSel.addEventListener('change', () => {
    sheet.querySelector('[data-custom-only]').style.display = typeSel.value === 'custom' ? '' : 'none';
  });

  sheet.querySelector('[data-x="back"]').onclick = openConsole;
  sheet.querySelector('[data-x="save"]').onclick = () => {
    const get = (f) => sheet.querySelector(`[data-f="${f}"]`).value.trim();
    if (!get('title')) { sheet.querySelector('#sec-err').textContent = 'A title is required.'; return; }
    Object.assign(s, {
      numeral: get('numeral'), category: get('category') || 'Chapter',
      title: get('title'), subtitle: get('subtitle') || get('title'),
      overline: get('overline') || get('category'), headline: get('headline') || get('title'),
    });
    if (isNew) {
      s.type = typeSel.value;
      s.id = 'm_' + get('title').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '_' + Date.now().toString(36);
    }
    if (s.type === 'custom') {
      s.body = sheet.querySelector('[data-f="body"]').value;
      const [label, ...rest] = get('link').split('|');
      s.link = rest.length ? { label: label.trim(), url: rest.join('|').trim() } : null;
    }
    if (isNew) sections().push(s);
    emitChange();
    openConsole();
    setStatus(isNew ? `"${s.title}" added` : `"${s.title}" saved`);
  };
}

/* ================= ITEM LIST + EDITOR ================= */
function openItemList(sectionId) {
  const s = sections().find((x) => x.id === sectionId);
  const rows = (s.items || []).map((it, i) => `
    <div class="admin-row" data-i="${i}">
      <div class="name"><b>${esc(itemLabel(s.type, it))}</b><span>item ${i + 1}</span></div>
      <button class="row-btn" data-act="up">↑</button>
      <button class="row-btn" data-act="down">↓</button>
      <button class="row-btn" data-act="edit">✎</button>
      <button class="row-btn" data-act="dup" title="Duplicate">⧉</button>
      <button class="row-btn danger" data-act="del">✕</button>
    </div>`).join('');

  const sheet = openSheet(`
    <div class="sheet-crest">${esc(s.title)}</div>
    <div class="sheet-title">Items</div>
    <div class="admin-list">${rows || '<p class="sheet-sub">No items yet.</p>'}</div>
    <div class="sheet-actions" style="justify-content:space-between">
      <button class="btn quiet" data-x="back">← Modules</button>
      <div style="display:flex;gap:.6rem">
        <button class="btn quiet" data-x="add">＋ Item</button>
        <button class="btn primary" data-x="done">Done</button>
      </div>
    </div>`, true);

  sheet.querySelector('[data-x="back"]').onclick = openConsole;
  sheet.querySelector('[data-x="done"]').onclick = closeSheet;
  sheet.querySelector('[data-x="add"]').onclick = () => openItemEditor(sectionId, -1);

  sheet.querySelector('.admin-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.row-btn');
    if (!btn) return;
    const i = +btn.closest('.admin-row').dataset.i;
    const act = btn.dataset.act;
    const arr = s.items;
    if (act === 'edit') openItemEditor(sectionId, i);
    if (act === 'dup') { const copy = JSON.parse(JSON.stringify(arr[i])); delete copy._id; arr.splice(i + 1, 0, copy); emitChange(); openItemList(sectionId); }
    if (act === 'up' && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; emitChange(); openItemList(sectionId); }
    if (act === 'down' && i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; emitChange(); openItemList(sectionId); }
    if (act === 'del') confirmSheet(`Delete "${itemLabel(s.type, arr[i])}"?`, () => { arr.splice(i, 1); emitChange(); openItemList(sectionId); });
  });
}

function openItemEditor(sectionId, index) {
  const s = sections().find((x) => x.id === sectionId);
  const schema = SCHEMAS[s.type] || SCHEMAS.projects;
  const isNew = index < 0;
  const it = isNew ? {} : s.items[index];

  const fields = schema.map((f) => {
    const val = esc(encodeField(f, it[f.k]));
    const input = f.t === 'textarea' || ['lines', 'pairs', 'links'].includes(f.t)
      ? `<textarea class="field" data-f="${f.k}">${val}</textarea>`
      : `<input class="field" data-f="${f.k}" value="${val}">`;
    return `<label class="field-label">${esc(f.label)}</label>${input}`;
  }).join('');

  const sheet = openSheet(`
    <div class="sheet-crest">${esc(s.title)}</div>
    <div class="sheet-title">${isNew ? 'Add item' : 'Edit item'}</div>
    ${fields}
    <div class="sheet-actions">
      <button class="btn quiet" data-x="back">Cancel</button>
      <button class="btn primary" data-x="save">${isNew ? 'Add item' : 'Save item'}</button>
    </div>`, true);

  sheet.querySelector('[data-x="back"]').onclick = () => openItemList(sectionId);
  sheet.querySelector('[data-x="save"]').onclick = () => {
    schema.forEach((f) => { it[f.k] = decodeField(f, sheet.querySelector(`[data-f="${f.k}"]`).value); });
    if (isNew) (s.items ??= []).push(it);
    emitChange();
    openItemList(sectionId);
    setStatus(isNew ? 'Item added' : 'Item saved');
  };
}

/* ================= GITHUB SETTINGS ================= */
function openGithubSheet() {
  const g = state.config.meta.github || (state.config.meta.github = {});
  const sheet = openSheet(`
    <div class="sheet-crest">Publishing</div>
    <div class="sheet-title">GitHub sync</div>
    <p class="sheet-sub">Publishing writes <b>site-config.json</b> to your repo, so every visitor and device loads the same content. The token stays in this browser only — it is never uploaded.</p>
    <label class="field-label">Fine-grained token — Contents: Read & write</label>
    <input class="field" type="password" data-f="token" placeholder="${getToken() ? '•••••••• (saved — type to replace)' : 'github_pat_… or ghp_…'}" autocomplete="off">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem">
      <div><label class="field-label">Owner</label><input class="field" data-f="owner" value="${esc(g.owner || '')}"></div>
      <div><label class="field-label">Repo</label><input class="field" data-f="repo" value="${esc(g.repo || '')}"></div>
      <div><label class="field-label">Branch</label><input class="field" data-f="branch" value="${esc(g.branch || 'main')}"></div>
    </div>
    <p class="field-hint">No token? Use “Export JSON” in the console and commit the file to the repo yourself — same result.</p>
    <div class="sheet-actions">
      <button class="btn quiet" data-x="back">Back</button>
      <button class="btn primary" data-x="save">Save settings</button>
    </div>`);

  sheet.querySelector('[data-x="back"]').onclick = openConsole;
  sheet.querySelector('[data-x="save"]').onclick = () => {
    const get = (f) => sheet.querySelector(`[data-f="${f}"]`).value.trim();
    if (get('token')) saveToken(get('token'));
    g.owner = get('owner'); g.repo = get('repo'); g.branch = get('branch') || 'main';
    emitChange();
    openConsole();
    setStatus('GitHub settings saved');
  };
}

/* ================= PASSCODE SHEETS ================= */
export function openPassSheet(changing) {
  const sheet = openSheet(`
    <div class="sheet-crest">${changing ? 'Security' : 'First-time setup'}</div>
    <div class="sheet-title">${changing ? 'Change passcode' : 'Set a passcode'}</div>
    <p class="sheet-sub">The passcode protects edit mode. Only a salted PBKDF2 hash is stored — never the passcode itself.</p>
    <label class="field-label">New passcode (min 6 characters)</label>
    <input class="field" type="password" data-f="p1" autocomplete="new-password">
    <label class="field-label">Confirm</label>
    <input class="field" type="password" data-f="p2" autocomplete="new-password">
    <p class="err" id="pass-err"></p>
    <div class="sheet-actions">
      ${changing ? '<button class="btn quiet" data-x="back">Back</button>' : ''}
      <button class="btn primary" data-x="save">Set passcode</button>
    </div>`);

  sheet.querySelector('[data-x="back"]')?.addEventListener('click', openConsole);
  sheet.querySelector('[data-x="save"]').onclick = async () => {
    const p1 = sheet.querySelector('[data-f="p1"]').value;
    const p2 = sheet.querySelector('[data-f="p2"]').value;
    const err = sheet.querySelector('#pass-err');
    if (p1.length < 6) { err.textContent = 'Minimum 6 characters.'; return; }
    if (p1 !== p2) { err.textContent = 'Passcodes do not match.'; return; }
    await setPasscode(p1);
    closeSheet();
    if (!changing) enterEdit();
    setStatus('Passcode set — publish so all devices require it', true);
  };
}

export function openLoginSheet() {
  const sheet = openSheet(`
    <div class="sheet-crest">Private access</div>
    <div class="sheet-title">Authentication</div>
    <p class="sheet-sub">Enter your passcode to unlock edit mode.</p>
    <input class="field" type="password" data-f="pass" placeholder="••••••••" autocomplete="current-password">
    <p class="err" id="login-err"></p>
    <div class="sheet-actions">
      <button class="btn quiet" data-x="back">Cancel</button>
      <button class="btn primary" data-x="go">Unlock</button>
    </div>`);

  const input = sheet.querySelector('[data-f="pass"]');
  const attempt = async () => {
    if (await verifyPasscode(input.value)) { closeSheet(); enterEdit(); }
    else { sheet.querySelector('#login-err').textContent = 'Incorrect passcode.'; input.value = ''; input.focus(); }
  };
  sheet.querySelector('[data-x="back"]').onclick = closeSheet;
  sheet.querySelector('[data-x="go"]').onclick = attempt;
  input.addEventListener('keydown', (e) => e.key === 'Enter' && attempt());
}

export function requestEdit() {
  if (editMode) { exitEdit(); return; }
  if (state.config.passHash?.hash) openLoginSheet();
  else openPassSheet(false);
}

/* ================= SAVE / PUBLISH ================= */
export async function publish() {
  setStatus('Publishing to GitHub…');
  cacheConfig();
  const res = await publishConfig();
  setStatus(res.ok ? '◆ ' + res.msg : 'Cached locally · GitHub: ' + res.msg, res.ok);
}
