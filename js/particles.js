/* ============================================================
   PARTICLES — quiet ambient field behind everything.
   Sparse drifting motes with faint constellation links.
   Follows theme tokens; pauses when the tab is hidden.
   ============================================================ */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Same mobile heuristic as atom.js. The constellation-link pass below
   is O(n²) over the mote count — by far the hottest part of this loop —
   so mobile drops it entirely rather than just thinning it, and gets
   fewer motes and a lower dpr on top of that. */
const COARSE = matchMedia('(pointer: coarse)').matches;
const NARROW = matchMedia('(max-width: 720px)').matches;
const LOW_CORES = (navigator.hardwareConcurrency || 8) <= 4;
const MOBILE = COARSE && (NARROW || LOW_CORES);
const DPR_CAP = MOBILE ? 1.5 : 2;
const TARGET_FPS = MOBILE ? 30 : 60;
const FRAME_BUDGET = 1000 / TARGET_FPS;

export function mountField(canvas) {
  const ctx = canvas.getContext('2d');
  let motes = [];
  let running = true;
  let dpr = 1;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Mobile: fewer motes and a lower cap, since the link pass is skipped
    // anyway and we're targeting a much smaller compositing budget.
    const count = MOBILE
      ? Math.min(30, Math.max(14, Math.floor((innerWidth * innerHeight) / 42000)))
      : Math.min(80, Math.max(26, Math.floor((innerWidth * innerHeight) / 26000)));
    motes = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: Math.random() * 1.5 + 0.3,
      ph: Math.random() * Math.PI * 2,
      depth: Math.random(),
    }));
  };

  const rgb = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').split(',').map((n) => parseInt(n, 10));
    return v.length === 3 && v.every(Number.isFinite) ? v : [212, 168, 76];
  };

  let lastPaint = 0;
  function frame(now = 0) {
    // Mobile: paint at TARGET_FPS instead of every rAF tick (matches the
    // same throttle used in atom.js, so both canvases share one budget).
    if (MOBILE && now - lastPaint < FRAME_BUDGET) {
      if (!REDUCED) requestAnimationFrame(frame);
      return;
    }
    lastPaint = now;

    if (running) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const [r, g, b] = rgb();
      const light = document.documentElement.dataset.mode === 'light';
      const baseA = light ? 0.5 : 0.35;
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.x += m.vx; m.y += m.vy; m.ph += 0.008;
        if (m.x < 0) m.x = innerWidth; if (m.x > innerWidth) m.x = 0;
        if (m.y < 0) m.y = innerHeight; if (m.y > innerHeight) m.y = 0;
        const a = (0.15 + 0.45 * m.depth) * (0.55 + 0.45 * Math.sin(m.ph)) * baseA;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.fill();
        // Constellation links are O(n²) — the most expensive part of this
        // loop by far. Mobile skips them entirely; the field still reads
        // as ambient drifting motes, just without the connecting lines.
        if (!MOBILE) {
          for (let j = i + 1; j < motes.length; j++) {
            const n = motes[j];
            const dx = m.x - n.x, dy = m.y - n.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 8100) {
              ctx.beginPath();
              ctx.moveTo(m.x, m.y);
              ctx.lineTo(n.x, n.y);
              ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - d2 / 8100) * 0.06})`;
              ctx.lineWidth = 0.35;
              ctx.stroke();
            }
          }
        }
      }
    }
    if (!REDUCED) requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });
  resize();
  requestAnimationFrame(frame);
}
