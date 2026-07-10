/* ============================================================
   ATOM — the signature instrument, quantum edition.
   Electrons are NOT on planetary orbits. They render as a
   probability cloud sampled from hydrogen-like |ψ|² densities:
     · 1s  — dense spherical core           (r² e^-2r)
     · 2p  — dumbbell lobes along z         (r⁴ e^-r · cos²θ)
     · 3d  — four-lobe geometry (excited)   (r⁶ e^-2r/3 · sin⁴θ sin²2φ)
   Points stochastically resample ("quantum jumps"), bright
   measurement flashes mark detection events, and hovering
   excites the atom — the cloud morphs from n=1,2 into n=3
   lobes. Nucleus stays a metallic nucleon cluster. Faint shell
   rings remain as instrument guides only.
   ============================================================ */

const TAU = Math.PI * 2;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- mobile / low-power detection ----------
   Coarse pointer + narrow viewport = phone-class device. We keep the
   exact same |ψ|² math, shells, nucleus and spin — only the sample
   COUNT, canvas resolution cap, and target frame rate scale down, so
   the instrument is unmistakably the same atom, just lighter to paint. */
const COARSE = matchMedia('(pointer: coarse)').matches;
const NARROW = matchMedia('(max-width: 720px)').matches;
const LOW_CORES = (navigator.hardwareConcurrency || 8) <= 4;
const MOBILE = COARSE && (NARROW || LOW_CORES);
const DPR_CAP = MOBILE ? 1.5 : 2;
const PARTICLE_SCALE = MOBILE ? 0.4 : 1;
const TARGET_FPS = MOBILE ? 30 : 60;
const FRAME_BUDGET = 1000 / TARGET_FPS;

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function accentRgb() {
  const v = cssVar('--accent-rgb', '212, 168, 76').split(',').map((n) => parseInt(n, 10));
  return v.length === 3 && v.every(Number.isFinite) ? v : [212, 168, 76];
}

function rotate(p, rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const y1 = p.y * cx - p.z * sx, z1 = p.z * cx + p.y * sx;
  return { x: p.x * cy + z1 * sy, y: y1, z: z1 * cy - p.x * sy };
}

/* ---------- |ψ|² samplers (rejection sampling, radii in units of R) ---------- */
const rnd = Math.random;

function sphereDir() {
  const u = rnd() * TAU, v = Math.acos(2 * rnd() - 1);
  return { x: Math.sin(v) * Math.cos(u), y: Math.sin(v) * Math.sin(u), z: Math.cos(v) };
}

/* 1s: P(r) ∝ r² e^(-2r), peak at r=1 */
function sample1s() {
  let r;
  do { r = rnd() * 4; } while (rnd() > (r * r * Math.exp(-2 * r)) / 0.1354);
  const d = sphereDir();
  const s = r * 0.3;
  return { x: d.x * s, y: d.y * s, z: d.z * s };
}

/* 2p_z: P(r) ∝ r⁴ e^(-r) peak r=4 · angular cos²θ (dumbbell along z) */
function sample2p() {
  let r;
  do { r = rnd() * 11; } while (rnd() > (r ** 4 * Math.exp(-r)) / 4.6888);
  let ct;
  do { ct = 2 * rnd() - 1; } while (rnd() > ct * ct);
  const st = Math.sqrt(1 - ct * ct), ph = rnd() * TAU;
  const s = r * 0.115;
  return { x: st * Math.cos(ph) * s, y: st * Math.sin(ph) * s, z: ct * s };
}

/* 3d_xy-like: P(r) ∝ r⁶ e^(-2r/3) peak r=9 · angular sin⁴θ sin²2φ (four lobes) */
function sample3d() {
  let r;
  do { r = rnd() * 22; } while (rnd() > (r ** 6 * Math.exp(-2 * r / 3)) / 1319);
  let ct, st, ph;
  do {
    ct = 2 * rnd() - 1;
    st = Math.sqrt(1 - ct * ct);
    ph = rnd() * TAU;
  } while (rnd() > st ** 4 * Math.sin(2 * ph) ** 2);
  const s = r * 0.062;
  return { x: st * Math.cos(ph) * s, y: st * Math.sin(ph) * s, z: ct * s };
}

export function mountAtom(canvas, hud = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;
  let W = 0, H = 0, R = 0, focal = 520;
  let rotX = -0.35, rotY = 0.4;
  let targetX = rotX, targetY = rotY;
  let energy = 0, targetEnergy = 0;
  let t = 0, lastFrame = performance.now(), fps = 60;

  /* ---------- probability cloud ----------
     Counts scale by PARTICLE_SCALE on mobile (same 900:1300:1300 ratio,
     so density/shape reads identically — just fewer sampled points). */
  const N_CORE = Math.round(900 * PARTICLE_SCALE);
  const N_P = Math.round(1300 * PARTICLE_SCALE);
  const N_D = Math.round(1300 * PARTICLE_SCALE);
  const cloud = [];
  for (let i = 0; i < N_CORE; i++) cloud.push({ g: sample1s(), e: sample1s(), core: true, tw: rnd() * TAU, a: 0.3 + rnd() * 0.45 });
  for (let i = 0; i < N_P; i++) cloud.push({ g: sample2p(), e: sample3d(), core: false, tw: rnd() * TAU, a: 0.25 + rnd() * 0.45 });
  for (let i = 0; i < N_D; i++) cloud.push({ g: sample2p(), e: sample3d(), core: false, tw: rnd() * TAU, a: 0.22 + rnd() * 0.4 });

  /* ---------- measurement flashes (detection events) ---------- */
  const flashes = [];
  let nextFlash = 0;

  /* ---------- shell guide rings (instrument reference, not orbits) ---------- */
  const RINGS = [
    { tiltX: 0.4, tiltY: 0.2, r: 0.46 },
    { tiltX: 1.7, tiltY: 0.9, r: 0.78 },
    { tiltX: 0.9, tiltY: 2.1, r: 1.02 },
  ];

  /* ---------- nucleus ---------- */
  const nucleons = [];
  for (let i = 0; i < 13; i++) {
    const phi = Math.acos(1 - 2 * ((i + 0.5) / 13));
    const th = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = i === 0 ? 0 : 0.62;
    nucleons.push({
      x: r * Math.sin(phi) * Math.cos(th),
      y: r * Math.sin(phi) * Math.sin(th),
      z: r * Math.cos(phi),
      proton: i % 2 === 0,
    });
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    W = w; H = h; R = Math.min(w, h) * 0.4; focal = R * 3.4;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pointTo(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width - 0.5;
    const ny = (clientY - rect.top) / rect.height - 0.5;
    const near = nx > -0.8 && nx < 0.8 && ny > -0.8 && ny < 0.8;
    targetEnergy = near ? 1 : 0;
    if (near) { targetY = 0.4 + nx * 1.1; targetX = -0.35 + ny * 0.9; }
  }
  addEventListener('mousemove', (e) => pointTo(e.clientX, e.clientY), { passive: true });
  canvas.addEventListener('touchmove', (e) => pointTo(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  canvas.addEventListener('touchend', () => { targetEnergy = 0; }, { passive: true });

  const project = (p) => {
    const s = focal / (focal + p.z * R);
    return { x: W / 2 + p.x * R * s, y: H / 2 + p.y * R * s, s };
  };

  function drawRing(o, front, r, g, b) {
    ctx.beginPath();
    let started = false;
    for (let a = 0; a <= TAU + 0.05; a += 0.09) {
      const p = rotate(rotate({ x: Math.cos(a) * o.r, y: Math.sin(a) * o.r * 0.42, z: 0 }, o.tiltX, o.tiltY + t * 0.05), rotX, rotY);
      if (front ? p.z < 0 : p.z >= 0) { started = false; continue; }
      const q = project(p);
      if (!started) { ctx.moveTo(q.x, q.y); started = true; }
      else ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = `rgba(${r},${g},${b},${front ? 0.14 : 0.05})`;
    ctx.lineWidth = front ? 0.8 : 0.5;
    ctx.stroke();
  }

  function drawNucleus(r, g, b) {
    const wobble = 1 + 0.03 * Math.sin(t * 2.1);
    const list = nucleons
      .map((n) => ({ ...rotate({ x: n.x, y: n.y, z: n.z }, t * 0.18, t * 0.26), proton: n.proton }))
      .sort((a, c) => c.z - a.z);
    for (const n of list) {
      const q = project({ x: n.x * 0.085 * wobble, y: n.y * 0.085 * wobble, z: n.z * 0.085 * wobble });
      const rad = R * 0.045 * q.s;
      const grad = ctx.createRadialGradient(q.x - rad * 0.35, q.y - rad * 0.4, rad * 0.1, q.x, q.y, rad);
      if (n.proton) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, `rgb(${r},${g},${b})`);
        grad.addColorStop(1, `rgba(${Math.floor(r * 0.35)},${Math.floor(g * 0.35)},${Math.floor(b * 0.35)},1)`);
      } else {
        grad.addColorStop(0, '#f4f2ee');
        grad.addColorStop(0.4, '#9a948a');
        grad.addColorStop(1, '#2c2a26');
      }
      ctx.beginPath();
      ctx.arc(q.x, q.y, rad, 0, TAU);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    const c = project({ x: 0, y: 0, z: 0 });
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R * 0.24);
    glow.addColorStop(0, `rgba(${r},${g},${b},${0.2 + energy * 0.12})`);
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - R * 0.24, c.y - R * 0.24, R * 0.48, R * 0.48);
  }

  let rafPending = 0;
  function frame(now) {
    // On mobile, skip frames that arrive faster than the target budget
    // (e.g. a 120Hz phone display) so we paint at ~30fps instead of 60-120fps.
    const elapsed = now - rafPending;
    if (MOBILE && elapsed < FRAME_BUDGET && rafPending) {
      if (!REDUCED) requestAnimationFrame(frame);
      return;
    }
    rafPending = now;

    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    fps += ((1 / Math.max(dt, 1e-4)) - fps) * 0.05;
    t += dt;

    rotX += (targetX - rotX) * 0.045;
    rotY += (targetY - rotY) * 0.045;
    energy += (targetEnergy - energy) * 0.05;
    if (!targetEnergy) targetY += dt * 0.1; // idle drift
    const mix = energy * energy * (3 - 2 * energy); // smoothstep state blend

    ctx.clearRect(0, 0, W, H);
    const [r, g, b] = accentRgb();

    RINGS.forEach((o) => drawRing(o, false, r, g, b));

    /* --- |ψ|² cloud --- */
    for (const c of cloud) {
      // quantum jump: occasionally the electron is "somewhere else entirely"
      if (rnd() < 0.006) {
        if (c.core) { c.g = sample1s(); c.e = sample1s(); }
        else { c.g = sample2p(); c.e = sample3d(); }
      }
      const m = c.core ? 0 : mix;
      const p = rotate({
        x: c.g.x + (c.e.x - c.g.x) * m,
        y: c.g.y + (c.e.y - c.g.y) * m,
        z: c.g.z + (c.e.z - c.g.z) * m,
      }, rotX, rotY);
      const q = project(p);
      const twinkle = 0.65 + 0.35 * Math.sin(t * 2.2 + c.tw);
      const a = c.a * twinkle * q.s * (c.core ? 0.85 : 0.75 + mix * 0.3);
      const size = (c.core ? 1.05 : 1.25) * q.s;
      if (c.core) {
        // hotter, whiter core
        ctx.fillStyle = `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 50)},${a})`;
      } else {
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      }
      ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
    }

    /* --- measurement flashes: an electron is "detected" --- */
    if (t > nextFlash) {
      nextFlash = t + 0.35 + rnd() * 0.5 - energy * 0.2;
      const c = cloud[(rnd() * cloud.length) | 0];
      const m = c.core ? 0 : mix;
      flashes.push({
        x: c.g.x + (c.e.x - c.g.x) * m,
        y: c.g.y + (c.e.y - c.g.y) * m,
        z: c.g.z + (c.e.z - c.g.z) * m,
        t0: t,
      });
      if (flashes.length > 4) flashes.shift();
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      const age = (t - f.t0) / 0.7;
      if (age >= 1) { flashes.splice(i, 1); continue; }
      const q = project(rotate(f, rotX, rotY));
      const fade = (1 - age) * (1 - age);
      const rad = (3 + age * 9) * q.s;
      const halo = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
      halo.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      halo.addColorStop(0.3, `rgba(${r},${g},${b},${0.7 * fade})`);
      halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(q.x, q.y, rad, 0, TAU);
      ctx.fillStyle = halo;
      ctx.fill();
    }

    drawNucleus(r, g, b);
    RINGS.forEach((o) => drawRing(o, true, r, g, b));

    /* --- HUD --- */
    if (hud.tr) hud.tr.innerHTML = `|ψ|² <b>${cloud.length}</b> pts · Z <b>6</b>`;
    if (hud.tl) hud.tl.innerHTML = `θ <b>${(((rotY % TAU) + TAU) % TAU).toFixed(2)}</b> rad`;
    if (hud.bl) hud.bl.innerHTML = energy > 0.4
      ? `EXCITED · n=3 (3d) · <b>${Math.round(fps)}</b> fps`
      : `GROUND · n=1,2 (1s 2p) · <b>${Math.round(fps)}</b> fps`;

    if (!REDUCED && visible) requestAnimationFrame(frame);
  }

  /* Pause entirely when off-screen (scrolled past on mobile) or the
     tab is hidden — same trick particles.js already uses, applied
     here too since the atom is the most expensive draw on the page. */
  let visible = true;
  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(([entry]) => {
      const wasVisible = visible;
      visible = entry.isIntersecting;
      if (visible && !wasVisible) { lastFrame = performance.now(); requestAnimationFrame(frame); }
    }, { threshold: 0.01 }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visible) { lastFrame = performance.now(); requestAnimationFrame(frame); }
  });

  resize();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(wrap);
  else addEventListener('resize', resize);
  requestAnimationFrame(frame);
  if (REDUCED) requestAnimationFrame(frame); // single static frame
}
