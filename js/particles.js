/* ============================================================
   PARTICLES — quiet ambient field behind everything.
   Sparse drifting motes with faint constellation links.
   Follows theme tokens; pauses when the tab is hidden.
   ============================================================ */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountField(canvas) {
  const ctx = canvas.getContext('2d');
  let motes = [];
  let running = true;

  const resize = () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const count = Math.min(80, Math.max(26, Math.floor((innerWidth * innerHeight) / 26000)));
    motes = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
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

  function frame() {
    if (running) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const [r, g, b] = rgb();
      const light = document.documentElement.dataset.mode === 'light';
      const baseA = light ? 0.5 : 0.35;
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.x += m.vx; m.y += m.vy; m.ph += 0.008;
        if (m.x < 0) m.x = canvas.width; if (m.x > canvas.width) m.x = 0;
        if (m.y < 0) m.y = canvas.height; if (m.y > canvas.height) m.y = 0;
        const a = (0.15 + 0.45 * m.depth) * (0.55 + 0.45 * Math.sin(m.ph)) * baseA;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.fill();
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
    if (!REDUCED) requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });
  resize();
  frame();
}
