/* ============================================================
   RESUME-LATEX — the pure data layer of Résumé Mode.

     site-config.json ──▶ buildResumeJson() ──▶ resume.json
     resume.json + resume/resume-template.tex ──▶ renderResumeTex()
     .tex ──▶ compileResumeTex() (texlive.net, pdflatex) ──▶ PDF

   No DOM, no app state — every function takes plain data, so the
   whole pipeline is testable outside the browser. All portfolio
   content is treated as untrusted plain text and escaped before
   it reaches LaTeX; only resume-template.tex contains raw LaTeX.
   ============================================================ */

/* ---------------- resume.json: normalized schema ----------------
   {
     header: { name, phone, email, links: [{ label, url }] },
     sections: [{
       id, title,
       kind: 'timeline' | 'projects' | 'skills' | 'achievements',
       items: [ …kind-specific normalized entries… ]
     }]
   }
   timeline item:     { heading, period, org, metaRight, bullets[], tagsLabel, tags[] }
   projects item:     { title, right, links[{label,url}], bullets[] }
   skills item:       { label, text }
   achievements item: { label, text }
------------------------------------------------------------------ */

const arr = (v) => (Array.isArray(v) ? v : []);
const txt = (v) => String(v ?? '').trim();

/** Sections whose cards can be included in the résumé. Contact feeds the
    header automatically; custom sections have a body, not cards. */
export const isResumeEligible = (s) =>
  !!s && Array.isArray(s.items) && s.type !== 'contact' && s.type !== 'custom';

const KIND_BY_TYPE = {
  timeline: 'timeline',
  projects: 'projects',
  skills: 'skills',
  achievements: 'achievements',
};

/* ---------------- header from hero + contact section ---------------- */
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

function buildHeader(cfg) {
  const hero = cfg.hero || {};
  const name =
    [hero.nameLine1, hero.nameLine2].map(txt).filter(Boolean).join(' ') ||
    txt((cfg.meta?.title || '').split('·')[0]) || 'Résumé';

  const contact = arr(cfg.sections).find((s) => s.type === 'contact');
  let phone = null;
  let email = null;
  const links = [];

  for (const it of arr(contact?.items)) {
    const u = txt(it.url);
    const label = txt(it.label);
    if (/^mailto:/i.test(u)) {
      email ??= label.includes('@') ? label : u.replace(/^mailto:/i, '');
    } else if (/^tel:/i.test(u)) {
      phone ??= /\d/.test(label) ? label : u.replace(/^tel:/i, '');
    } else if (/linkedin\./i.test(u)) {
      links.push({ label: 'LinkedIn', url: u, rank: 2 });
    } else if (/github\.io/i.test(u)) {
      links.push({ label: 'Portfolio', url: u, rank: 1 });
    } else if (/github\./i.test(u)) {
      links.push({ label: 'GitHub', url: u, rank: 3 });
    } else if (/^https?:/i.test(u)) {
      const short = txt(label.split(/—|\|/)[0]).slice(0, 24) || hostOf(u);
      links.push({ label: short, url: u, rank: 4 });
    }
    // anything else (unlabeled schemes) is not a résumé-header link
  }

  // The portfolio itself, derived from the publishing target, if the
  // contact section doesn't already carry a website link.
  if (!links.some((l) => l.label === 'Portfolio')) {
    const g = cfg.meta?.github;
    if (g?.owner && g?.repo) {
      links.push({
        label: 'Portfolio',
        url: `https://${String(g.owner).toLowerCase()}.github.io/${g.repo}/`,
        rank: 1,
      });
    }
  }

  links.sort((a, b) => a.rank - b.rank);
  return { name, phone, email, links: links.map(({ label, url }) => ({ label, url })) };
}

/* ---------------- per-type item normalization ---------------- */

/** One meta pair for the right of a timeline entry's second line.
    Grade-like pairs (CGPA/GPA/score) win; period duplicates are dropped
    as redundant metadata (one-page fitting, rule 3). */
function pickMetaPair(it) {
  const pairs = arr(it.meta).filter(
    (m) => m && txt(m.k) && txt(m.v) && !/period/i.test(m.k) && txt(m.v) !== txt(it.period)
  );
  if (!pairs.length) return '';
  const grade = pairs.find((m) => /gpa|grade|score|percent/i.test(m.k));
  const m = grade || pairs[0];
  return `${txt(m.k)}: ${txt(m.v)}`;
}

const normalize = {
  timeline: (s, it) => ({
    heading: txt(it.heading),
    period: txt(it.period),
    org: txt(it.org),
    metaRight: pickMetaPair(it),
    bullets: arr(it.bullets).map(txt).filter(Boolean),
    tagsLabel: /educat/i.test(`${s.title} ${s.id}`) ? 'Coursework' : 'Key topics',
    tags: arr(it.tags).map(txt).filter(Boolean),
  }),
  projects: (s, it) => ({
    title: txt(it.title) || txt(it.heading) || 'Untitled',
    right: txt(it.subtitle) || txt(it.tag),
    links: arr(it.links)
      .filter((l) => l && txt(l.url) && txt(l.url) !== '#')
      .map((l) => ({ label: txt(l.label) || 'link', url: txt(l.url) })),
    bullets: txt(it.description) ? [txt(it.description)] : [],
  }),
  skills: (s, it) => ({
    label: txt(it.group),
    text: arr(it.tags).map(txt).filter(Boolean).join(', '),
  }),
  achievements: (s, it) => ({
    label: txt(it.title),
    text: txt(it.description),
  }),
};

/* ---------------- config + selection → resume.json ---------------- */
export function buildResumeJson(cfg) {
  const selected = new Set(arr(cfg.resume?.selectedItems));
  const sections = [];

  for (const s of arr(cfg.sections)) {
    if (!isResumeEligible(s)) continue;
    const kind = KIND_BY_TYPE[s.type] || 'projects'; // future types: generic entry
    const items = arr(s.items)
      .filter((it) => it && it._id && selected.has(it._id)) // portfolio card order preserved
      .map((it) => (normalize[kind] || normalize.projects)(s, it));
    if (items.length) sections.push({ id: s.id, title: txt(s.title) || s.id, kind, items });
  }

  return { header: buildHeader(cfg), sections };
}

/* ---------------- LaTeX escaping ----------------
   Portfolio JSON is plain text by default. Specials are escaped in a
   single pass (no double-escaping), then risky unicode is mapped to
   safe LaTeX; anything still exotic (emoji, dingbats) is dropped and
   counted so the UI can mention it. */
const SPECIALS = {
  '\\': '\\textbackslash{}',
  '{': '\\{', '}': '\\}',
  '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_',
  '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
};

const UNICODE_MAP = {
  '\u00A0': '~',
  '–': '--', '—': '---', '−': '-', '‑': '-',
  '‘': '`', '’': "'", '“': '``', '”': "''", '…': '\\dots{}',
  '·': '$\\cdot$', '•': '$\\bullet$', '⋅': '$\\cdot$', '∗': '$*$',
  '≈': '$\\approx$', '×': '$\\times$', '±': '$\\pm$', '≤': '$\\le$',
  '≥': '$\\ge$', '≠': '$\\ne$', '∞': '$\\infty$', '√': '$\\surd$',
  '∂': '$\\partial$', '∈': '$\\in$', '∑': '$\\Sigma$', '∝': '$\\propto$',
  '→': '$\\rightarrow$', '←': '$\\leftarrow$', '↔': '$\\leftrightarrow$',
  '⇒': '$\\Rightarrow$', '⇐': '$\\Leftarrow$', '↑': '$\\uparrow$', '↓': '$\\downarrow$',
  'α': '$\\alpha$', 'β': '$\\beta$', 'γ': '$\\gamma$', 'δ': '$\\delta$',
  'ε': '$\\varepsilon$', 'θ': '$\\theta$', 'λ': '$\\lambda$', 'μ': '$\\mu$',
  'µ': '$\\mu$', 'π': '$\\pi$', 'ρ': '$\\rho$', 'σ': '$\\sigma$',
  'τ': '$\\tau$', 'φ': '$\\varphi$', 'χ': '$\\chi$', 'ω': '$\\omega$',
  'Γ': '$\\Gamma$', 'Δ': '$\\Delta$', 'Θ': '$\\Theta$', 'Λ': '$\\Lambda$',
  'Π': '$\\Pi$', 'Σ': '$\\Sigma$', 'Φ': '$\\Phi$', 'Ψ': '$\\Psi$',
  'ψ': '$\\psi$', 'Ω': '$\\Omega$', 'ℏ': '$\\hbar$', 'Ĥ': '\\^{H}',
  '°': '$^{\\circ}$', '✓': '$\\surd$', '★': '$\\star$', '◆': '$\\blacklozenge$',
  '²': '\\textsuperscript{2}', '³': '\\textsuperscript{3}', '¹': '\\textsuperscript{1}',
  '⁰': '\\textsuperscript{0}', '⁴': '\\textsuperscript{4}', '⁵': '\\textsuperscript{5}',
  '⁶': '\\textsuperscript{6}', '⁷': '\\textsuperscript{7}', '⁸': '\\textsuperscript{8}',
  '⁹': '\\textsuperscript{9}',
  '₀': '\\textsubscript{0}', '₁': '\\textsubscript{1}', '₂': '\\textsubscript{2}',
  '₃': '\\textsubscript{3}', '₄': '\\textsubscript{4}',
};
const UNICODE_RE = new RegExp(`[${Object.keys(UNICODE_MAP).join('')}]`, 'gu');

/** Escape untrusted text for LaTeX. `stats.dropped` counts characters
    that had to be removed entirely (no safe pdflatex mapping). */
export function escapeLatex(value, stats) {
  let s = String(value ?? '');
  s = s.replace(/[\\{}&%$#_~^]/g, (ch) => SPECIALS[ch]);
  s = s.replace(UNICODE_RE, (ch) => UNICODE_MAP[ch]);
  // keep ASCII + Latin-1/Latin-Ext-A letters (utf8 inputenc handles those);
  // drop anything else so visitor-editable text can never abort a compile.
  s = s.replace(/[^\x20-\x7E\n\r\t\u00A1-\u00FF\u0100-\u017F]/g, () => {
    if (stats) stats.dropped += 1;
    return '';
  });
  return s;
}

/** URLs inside \href{…}: strip structural chars, escape the rest the
    way hyperref expects. */
export function safeUrl(u) {
  return String(u ?? '')
    .trim()
    .replace(/[\\{}\s"']/g, '')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/&/g, '\\&')
    .replace(/_/g, '\\_');
}

/* ---------------- resume.json + template → .tex ---------------- */
const COMPACT_TEX = `% one-page compact overrides (user-triggered)
\\titlespacing{\\section}{0pt}{3pt}{1.5pt}
\\setlist[itemize]{leftmargin=1.15em, itemsep=0pt, topsep=0pt, parsep=0pt, partopsep=0pt}
\\renewcommand{\\entrygap}{\\vspace{0.5pt}}`;

const itemize = (bullets, T) =>
  `\\begin{itemize}\n${bullets.map((b) => `  \\item ${T(b)}`).join('\n')}\n\\end{itemize}`;

function timelineTex(it, T) {
  const lines = [`\\entry{${T(it.heading)}}{${T(it.period)}}`];
  if (it.org || it.metaRight) {
    lines.push(`{\\small ${T(it.org)}${it.metaRight ? ` \\hfill ${T(it.metaRight)}` : ''}}`);
  }
  if (it.tags.length) {
    lines.push(`{\\small\\textit{${T(it.tagsLabel)}:} ${T(it.tags.join(', '))}}`);
  }
  let tex = lines.join('\\\\\n');
  if (it.bullets.length) tex += '\n' + itemize(it.bullets, T);
  return tex;
}

function projectTex(it, T) {
  const hrefs = it.links.map((l) => `\\href{${safeUrl(l.url)}}{${T(l.label)}}`);
  const right = [it.right ? T(it.right) : '', ...hrefs].filter(Boolean).join(' $\\cdot$ ');
  let tex = `\\textbf{${T(it.title)}}${right ? ` \\hfill \\textit{${right}}` : ''}`;
  if (it.bullets.length) tex += '\n' + itemize(it.bullets, T);
  return tex;
}

const sectionBody = {
  timeline: (sec, T) => sec.items.map((i) => timelineTex(i, T)).join('\n\\entrygap\n'),
  projects: (sec, T) => sec.items.map((i) => projectTex(i, T)).join('\n\\entrygap\n'),
  skills: (sec, T) =>
    sec.items.map((i) => `\\textbf{${T(i.label)}:} ${T(i.text)}`).join('\\\\\n'),
  achievements: (sec, T) =>
    sec.items
      .map((i) => (i.text ? `\\textbf{${T(i.label)}} --- ${T(i.text)}` : `\\textbf{${T(i.label)}}`))
      .join('\\\\\n'),
};

function contactLine(header, T) {
  const parts = [];
  if (header.phone) parts.push(T(header.phone).replace(/ /g, '~'));
  if (header.email) parts.push(T(header.email));
  for (const l of header.links) parts.push(`\\href{${safeUrl(l.url)}}{${T(l.label)}}`);
  return parts.join(' \\;|\\; ');
}

/**
 * Render resume.json into the trusted template.
 * Returns { tex, dropped } — dropped = count of characters that had no
 * safe LaTeX mapping and were omitted.
 */
export function renderResumeTex(resume, template, opts = {}) {
  const stats = { dropped: 0 };
  const T = (s) => escapeLatex(s, stats);

  const body = resume.sections
    .map((sec) => `\\section{${T(sec.title)}}\n${(sectionBody[sec.kind] || sectionBody.projects)(sec, T)}`)
    .join('\n\n');

  // function replacements: escaped text contains `$`, which String.replace
  // would otherwise treat as a substitution pattern.
  const tex = template
    .replace('%%COMPACT%%', () => (opts.compact ? COMPACT_TEX : '%'))
    .replace('%%NAME%%', () => T(String(resume.header.name).toUpperCase()))
    .replace('%%CONTACT%%', () => contactLine(resume.header, T))
    .replace('%%BODY%%', () => body);

  return { tex, dropped: stats.dropped };
}

/* ---------------- compile: texlive.net (LaTeX Project CGI) ----------------
   POST multipart/form-data with exactly the documented fields — the
   service rejects submissions containing anything else. Returns the PDF
   bytes, or the compile log when LaTeX errors. There is no backend of
   our own: the template is repo-controlled, all content is escaped, and
   texlive.net is a public service, so no new attack surface is exposed. */
/* ---------------- compile: latex.ytotech.com (LaTeX-on-HTTP) ----------------
   POST JSON with the document content. The service has CORS enabled
   (Access-Control-Allow-Origin: *), so it works directly from GitHub Pages.
   
   Returns the PDF bytes on success, or the compile log when LaTeX errors.
   No backend of our own is needed: the template is repo-controlled, all 
   content is escaped, and latex.ytotech.com is a public service. */
export async function compileResumeTex(texSource, { timeoutMs = 90000 } = {}) {
  const payload = {
    compiler: 'pdflatex',
    resources: [
      {
        main: true,
        content: texSource,
      },
    ],
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://latex.ytotech.com/builds/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    const buf = await res.arrayBuffer();

    if (res.ok) {
      const head = new TextDecoder().decode(buf.slice(0, 5));
      const type = res.headers.get('content-type') || '';
      if (head === '%PDF-' || type.includes('pdf')) {
        return { ok: true, pdf: buf };
      }
    }

    // Compilation error: parse JSON log response
    try {
      const json = JSON.parse(new TextDecoder().decode(buf));
      const logs = json.log_files || {};
      const logText = Object.values(logs).join('\n');
      return { ok: false, log: logText || json.error || 'Unknown compilation error' };
    } catch {
      return { ok: false, log: new TextDecoder().decode(buf) };
    }
  } catch (e) {
    return {
      ok: false,
      log:
        (e?.name === 'AbortError'
          ? 'Timed out contacting latex.ytotech.com.'
          : 'Could not reach latex.ytotech.com.') +
        ' Check your connection, or download the .tex and compile it in Overleaf/locally.\n' +
        (e?.message || ''),
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- small utilities ---------------- */

// Count "/Type /Page" (not "/Pages") and, as a fallback, the Pages node's
// "/Count N". Works on any decoded PDF text — compressed or not.
function pageCountFromText(s) {
  const pages = s.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  if (pages && pages.length) return pages.length;
  const m =
    s.match(/\/Type\s*\/Pages\b[\s\S]{0,600}?\/Count\s+(\d+)/) ||
    s.match(/\/Count\s+(\d+)[\s\S]{0,600}?\/Type\s*\/Pages\b/);
  return m ? +m[1] : null;
}

async function inflateFlateStreams(bytes) {
  // Modern pdfTeX stores page objects inside FlateDecode object streams, so
  // the page dictionaries never appear in the raw bytes. Inflate every
  // "/FlateDecode … stream … endstream" span and scan the decompressed text.
  if (typeof DecompressionStream === 'undefined') return '';
  const raw = new TextDecoder('latin1').decode(bytes);
  let out = '';
  const re = /\/FlateDecode\b[\s\S]*?stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    const slice = bytes.subarray(start, end); // may include a trailing EOL
    try {
      const ds = new DecompressionStream('deflate');
      const stream = new Response(new Blob([slice]).stream().pipeThrough(ds));
      out += new TextDecoder('latin1').decode(await stream.arrayBuffer()) + '\n';
    } catch {
      /* not raw zlib / truncated slice — skip this stream */
    }
  }
  return out;
}

/**
 * Best-effort page count. Returns a number, or null if it genuinely can't be
 * determined (the UI then simply omits the page note — never blocks download).
 * Async because decompression is; callers `await` it.
 */
export async function countPdfPages(buf) {
  try {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const plain = pageCountFromText(new TextDecoder('latin1').decode(bytes));
    if (plain) return plain;
    const inflated = await inflateFlateStreams(bytes);
    return inflated ? pageCountFromText(inflated) : null;
  } catch {
    return null;
  }
}

export function resumePdfFilename(name) {
  const base = String(name || 'Resume')
    .replace(/[.'’]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || 'Resume'}_Resume.pdf`;
}
