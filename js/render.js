/* ============================================================
   RENDER — pure JSON → DOM. Nothing on the page is hardcoded;
   every text node carries a data-path back into the config so
   inline editing can write straight to the source of truth.
   ============================================================ */
import { state, sections, sectionById } from './state.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** editable span helper */
const ed = (path, value, tag = 'span', cls = '') =>
  `<${tag}${cls ? ` class="${cls}"` : ''} data-path="${path}">${esc(value)}</${tag}>`;

/* Headline convention: "Academic |foundation|" → gradient on |...| */
function headline(h, path) {
  const html = esc(h).replace(/\|([^|]+)\|/g, '<em>$1</em>');
  return `<h2 class="d-title" data-path="${path}" data-rich="headline">${html}</h2>`;
}

let revealObserver;
function observeReveals(root) {
  revealObserver ??= new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
    { threshold: 0.05 }
  );
  root.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
}

/* ---------------- HERO + META ---------------- */
export function renderHero() {
  const h = state.config.hero;
  const m = state.config.meta;
  document.title = m.title;
  document.getElementById('brand-status').textContent = m.status || 'ONLINE';
  document.getElementById('foot').innerHTML = ed('meta.footer', m.footer);

  document.getElementById('hero-text').innerHTML = `
    <div class="eyebrow rise" style="animation-delay:.05s">${ed('hero.eyebrow', h.eyebrow)}</div>
    <h1 class="hero-name rise" style="animation-delay:.15s">
      ${ed('hero.nameLine1', h.nameLine1, 'span', 'l1')}
      ${ed('hero.nameLine2', h.nameLine2, 'span', 'l2')}
    </h1>
    <div class="hero-meta rise" style="animation-delay:.25s">
      ${h.meta.map((v, i) => ed(`hero.meta.${i}`, v)).join('<b>·</b>')}
    </div>
    <p class="hero-quote rise" style="animation-delay:.33s" data-path="hero.quote">${esc(h.quote)}</p>
    <div class="hero-ctas rise" style="animation-delay:.42s">
      <a class="cta solid" href="#${esc(h.ctaPrimary.section)}" data-open="${esc(h.ctaPrimary.section)}">${ed('hero.ctaPrimary.label', h.ctaPrimary.label)}</a>
      <a class="cta glass" href="#${esc(h.ctaSecondary.section)}" data-open="${esc(h.ctaSecondary.section)}">${ed('hero.ctaSecondary.label', h.ctaSecondary.label)}</a>
    </div>`;
  document.getElementById('hero-eq').innerHTML = ed('hero.equation', h.equation);
}

/* ---------------- MODULE GRID ---------------- */
export function renderModules(editMode) {
  const grid = document.getElementById('modules');
  grid.innerHTML = '';
  sections().forEach((s, i) => {
    if (s.hidden && !editMode) return;
    const el = document.createElement('article');
    el.className = `module reveal in${s.hidden ? ' is-hidden' : ''}`;
    el.tabIndex = 0;
    el.dataset.open = s.id;
    el.style.animationDelay = `${0.5 + i * 0.05}s`;
    el.innerHTML = `
      <div class="module-index">${esc(s.numeral)}</div>
      <div class="module-cat">${ed(`sections.${i}.category`, s.category)}</div>
      <h3 class="module-title">${ed(`sections.${i}.title`, s.title)}</h3>
      <p class="module-sub">${ed(`sections.${i}.subtitle`, s.subtitle)}</p>
      <div class="module-cta">Open module</div>`;
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
    grid.appendChild(el);
  });
  const add = document.createElement('button');
  add.className = 'module-add';
  add.id = 'module-add';
  add.innerHTML = '✦ &nbsp;Add module';
  grid.appendChild(add);
}

/* ---------------- DETAIL RENDERERS ---------------- */
const renderers = {
  timeline(s, si) {
    return s.items.map((it, i) => {
      const p = `sections.${si}.items.${i}`;
      return `<div class="panel reveal" data-item="${p}">
        <div class="p-row-top">
          <div>
            <div class="p-label">${ed(`sections.${si}.category`, s.category)}</div>
            <h3 class="p-head">${ed(`${p}.heading`, it.heading)}</h3>
            <p class="p-sub">${ed(`${p}.org`, it.org)}</p>
          </div>
          ${it.period ? `<span class="badge">${ed(`${p}.period`, it.period)}</span>` : ''}
        </div>
        ${it.meta?.length ? `<div class="meta-row">${it.meta.map((m, mi) =>
          `<div class="meta-item"><span class="k">${ed(`${p}.meta.${mi}.k`, m.k)}</span><span class="v">${ed(`${p}.meta.${mi}.v`, m.v)}</span></div>`).join('')}</div>` : ''}
        ${it.bullets?.length ? `<ul class="bullets">${it.bullets.map((b, bi) =>
          `<li data-path="${p}.bullets.${bi}">${esc(b)}</li>`).join('')}</ul>` : ''}
        ${it.tags?.length ? `<div class="tags">${it.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
  },

  projects(s, si) {
    return `<div class="proj-grid">${s.items.map((it, i) => {
      const p = `sections.${si}.items.${i}`;
      return `<article class="panel reveal" data-item="${p}">
        <div class="p-label">${ed(`${p}.tag`, it.tag)}</div>
        <h3 class="p-head">${ed(`${p}.title`, it.title)}</h3>
        <p class="p-sub">${ed(`${p}.subtitle`, it.subtitle)}</p>
        <p data-path="${p}.description">${esc(it.description)}</p>
        ${it.links?.length ? `<div class="links-row">${it.links.map((l) =>
          `<a class="link-chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div>` : ''}
      </article>`;
    }).join('')}</div>`;
  },

  skills(s, si) {
    return `<div class="skills-grid">${s.items.map((it, i) => {
      const p = `sections.${si}.items.${i}`;
      return `<div class="panel reveal" data-item="${p}">
        <div class="skill-title">${ed(`${p}.group`, it.group)}</div>
        <div class="tags">${(it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>`;
    }).join('')}</div>`;
  },

  achievements(s, si) {
    return s.items.map((it, i) => {
      const p = `sections.${si}.items.${i}`;
      return `<div class="panel reveal ach" data-item="${p}">
        <div class="ach-medal">${esc(it.icon || '◆')}</div>
        <div>
          <h3 class="p-head">${ed(`${p}.title`, it.title)}</h3>
          <p class="p-sub" data-path="${p}.description">${esc(it.description)}</p>
        </div>
      </div>`;
    }).join('');
  },

  contact(s, si) {
    return `${s.intro ? `<p class="contact-intro reveal" data-path="sections.${si}.intro">${esc(s.intro)}</p>` : ''}
      ${s.items.map((it, i) => {
        const p = `sections.${si}.items.${i}`;
        return `<a class="panel contact reveal" href="${esc(it.url)}" ${/^https?:/.test(it.url) ? 'target="_blank" rel="noopener"' : ''}>
          <span class="contact-icon">${esc(it.icon)}</span>
          ${ed(`${p}.label`, it.label)}
        </a>`;
      }).join('')}`;
  },

  custom(s, si) {
    return `<div class="panel reveal">
      <div class="p-label">${ed(`sections.${si}.category`, s.category)}</div>
      <div class="custom-body" data-path="sections.${si}.body">${esc(s.body || '')}</div>
      ${s.link?.url ? `<div class="links-row"><a class="link-chip" href="${esc(s.link.url)}" target="_blank" rel="noopener">${esc(s.link.label || 'Open')}</a></div>` : ''}
    </div>`;
  },
};

export function renderDetail(id) {
  const si = sections().findIndex((s) => s.id === id);
  const s = sectionById(id);
  const body = document.getElementById('detail-body');
  if (!s) { body.innerHTML = '<div class="empty">Module not found</div>'; return; }

  document.getElementById('crumb').textContent = `${s.numeral} · ${s.title}`;
  const items = (renderers[s.type] || renderers.custom)(s, si);
  body.innerHTML = `
    <div class="d-overline">${ed(`sections.${si}.overline`, s.overline || s.category)}</div>
    ${headline(s.headline || s.title, `sections.${si}.headline`)}
    <div class="d-rule"></div>
    ${items || '<div class="empty">No entries yet — add one from the admin console (✎ → ⌘)</div>'}`;
  observeReveals(body);
}

/* full re-render preserving current view */
export function renderAll(editMode, currentDetail) {
  renderHero();
  renderModules(editMode);
  if (currentDetail) renderDetail(currentDetail);
}
