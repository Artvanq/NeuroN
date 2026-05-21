import { useEffect, useRef } from 'react';

/**
 * NeuronCanvas — animated neural network background.
 * Pure canvas, dependency-free, gracefully degrades.
 *
 * Props:
 *   density   — nodes per 100kpx² (default 0.12). Lower on mobile.
 *   intensity — overall opacity multiplier (0..1, default 1).
 *   interactive — react to pointer move (default true).
 *   className — extra wrapper class.
 */
export default function NeuronCanvas({
  density = 0.12,
  intensity = 1,
  interactive = true,
  className = '',
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let nodes = [];
    let mouse = { x: -9999, y: -9999, active: false };
    let raf = null;
    let running = true;
    let lastTime = 0;
    let pulses = [];

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const effectiveDensity = isMobile ? density * 0.55 : density;
    const connectionDist = isMobile ? 130 : 170;

    function buildNodes() {
      const target = Math.max(
        24,
        Math.min(160, Math.round((width * height) / 10000 * effectiveDensity))
      );
      nodes = new Array(target).fill(null).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.2 + 0.6,
        baseAlpha: Math.random() * 0.4 + 0.3,
        hue: Math.random() < 0.18 ? 'cyan' : 'violet',
      }));
    }

    function resize() {
      const rect = wrapper.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNodes();
    }

    function spawnPulse() {
      if (nodes.length < 2 || pulses.length > 4) return;
      const a = nodes[(Math.random() * nodes.length) | 0];
      // Find a nearby neighbor to fire toward
      let b = null;
      let bestD = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n === a) continue;
        const dx = n.x - a.x;
        const dy = n.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD && d2 < connectionDist * connectionDist) {
          bestD = d2;
          b = n;
        }
      }
      if (!b) return;
      pulses.push({ a, b, t: 0, dur: 1100 + Math.random() * 600 });
    }

    function step(now) {
      if (!running) return;
      const dt = lastTime ? Math.min(now - lastTime, 50) : 16;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Drift nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!reducedMotion) {
          n.x += n.vx * (dt / 16);
          n.y += n.vy * (dt / 16);
        }
        if (n.x < -20) n.x = width + 20;
        else if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        else if (n.y > height + 20) n.y = -20;
      }

      // Connections
      const mouseRadius = 180;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > connectionDist) continue;
          const t = 1 - dist / connectionDist;

          let mouseBoost = 0;
          if (interactive && mouse.active) {
            const mx1 = a.x - mouse.x;
            const my1 = a.y - mouse.y;
            const mx2 = b.x - mouse.x;
            const my2 = b.y - mouse.y;
            const dm = Math.min(Math.hypot(mx1, my1), Math.hypot(mx2, my2));
            if (dm < mouseRadius) {
              mouseBoost = (1 - dm / mouseRadius) * 0.6;
            }
          }

          const alpha = (t * 0.22 + mouseBoost * 0.5) * intensity;
          if (alpha < 0.01) continue;

          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          const aColor = a.hue === 'cyan' ? '34, 211, 238' : '167, 139, 250';
          const bColor = b.hue === 'cyan' ? '34, 211, 238' : '167, 139, 250';
          grad.addColorStop(0, `rgba(${aColor}, ${alpha})`);
          grad.addColorStop(1, `rgba(${bColor}, ${alpha})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.6 + mouseBoost * 0.4;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        let alpha = n.baseAlpha;
        let radius = n.r;

        if (interactive && mouse.active) {
          const dm = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          if (dm < mouseRadius) {
            const boost = 1 - dm / mouseRadius;
            alpha = Math.min(1, alpha + boost * 0.55);
            radius += boost * 1.4;
          }
        }

        const color = n.hue === 'cyan' ? '34, 211, 238' : '167, 139, 250';
        ctx.fillStyle = `rgba(${color}, ${alpha * intensity})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle halo
        ctx.fillStyle = `rgba(${color}, ${alpha * 0.15 * intensity})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pulses (synapse firing)
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += dt;
        const k = p.t / p.dur;
        if (k >= 1) {
          pulses.splice(i, 1);
          continue;
        }
        const x = p.a.x + (p.b.x - p.a.x) * k;
        const y = p.a.y + (p.b.y - p.a.y) * k;
        const color = p.b.hue === 'cyan' ? '103, 232, 249' : '196, 181, 253';
        const fade = Math.sin(k * Math.PI);
        ctx.fillStyle = `rgba(${color}, ${0.95 * fade * intensity})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.8 + fade * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.fillStyle = `rgba(${color}, ${0.18 * fade * intensity})`;
        ctx.beginPath();
        ctx.arc(x, y, 6 + fade * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    }

    let pulseTimer = null;
    function startPulseLoop() {
      if (reducedMotion) return;
      const schedule = () => {
        spawnPulse();
        pulseTimer = setTimeout(schedule, 700 + Math.random() * 1400);
      };
      pulseTimer = setTimeout(schedule, 800);
    }

    function onMove(e) {
      if (!interactive) return;
      const rect = wrapper.getBoundingClientRect();
      mouse.x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      mouse.y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      mouse.active = true;
    }
    function onLeave() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    }
    function onVisibility() {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        if (pulseTimer) clearTimeout(pulseTimer);
      } else if (!running) {
        running = true;
        lastTime = 0;
        raf = requestAnimationFrame(step);
        startPulseLoop();
      }
    }

    resize();
    raf = requestAnimationFrame(step);
    startPulseLoop();

    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      if (pulseTimer) clearTimeout(pulseTimer);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density, intensity, interactive]);

  return (
    <div
      ref={wrapperRef}
      className={`neuron-canvas-wrap ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
