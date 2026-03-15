"use client";

import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const TITLE = "FilCraft";
const CINZEL = "var(--font-cinzel, Cinzel, serif)";

// Deterministic star field — stable across SSR/hydration
const STARS = Array.from({ length: 110 }, (_, i) => {
  const s = (i * 2654435761) >>> 0;
  const x = ((s * 1664525 + 1013904223) >>> 0) % 10000 / 100;
  const y = ((s * 22695477 + 1) >>> 0) % 10000 / 100;
  return { x, y, size: (i % 3) + 1, delay: (s % 5000) / 1000, dur: 2 + (s % 4) };
});

// Node colour palette
type NodeType = "agent" | "validator" | "storage";
const NODE_PALETTE: Record<NodeType, { hex: string; r: number; g: number; b: number }> = {
  agent:     { hex: "#f5d96a", r: 245, g: 217, b: 106 },
  validator: { hex: "#60a5fa", r: 96,  g: 165, b: 250 },
  storage:   { hex: "#34d399", r: 52,  g: 211, b: 153 },
};

// ─── Filecoin Logo — golden theme ────────────────────────────────────────────

function FilecoinLogo({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: "block" }}>
      {/* Golden circle */}
      <circle cx="20" cy="20" r="20" fill="#f5d96a" />
      {/* Inner ring accent */}
      <circle cx="20" cy="20" r="16.5" fill="none" stroke="rgba(10,8,4,0.12)" strokeWidth="0.8" />
      {/* Filecoin F path — dark on gold */}
      <path
        fill="#1a1208"
        d="M21.9,17.6l-0.6,3.2l5.7,0.8l-0.4,1.5L21,22.3c-0.4,1.3-0.6,2.7-1.1,3.9c-0.5,1.4-1,2.8-1.6,4.1
          c-0.8,1.7-2.2,2.9-4.1,3.2c-1.1,0.2-2.3,0.1-3.2-0.6c-0.3-0.2-0.6-0.6-0.6-0.9c0-0.4,0.2-0.9,0.5-1.1c0.2-0.1,0.7,0,1,0.1
          c0.3,0.3,0.6,0.7,0.8,1.1c0.6,0.8,1.4,0.9,2.2,0.3c0.9-0.8,1.4-1.9,1.7-3c0.6-2.4,1.2-4.7,1.7-7.1v-0.4L13,21.1l0.2-1.5l5.5,0.8
          l0.7-3.1l-5.7-0.9l0.2-1.6l5.9,0.8c0.2-0.6,0.3-1.1,0.5-1.6c0.5-1.8,1-3.6,2.2-5.2s2.6-2.6,4.7-2.5c0.9,0,1.8,0.3,2.4,1
          c0.1,0.1,0.3,0.3,0.3,0.5c0,0.4,0,0.9-0.3,1.2c-0.4,0.3-0.9,0.2-1.3-0.2c-0.3-0.3-0.5-0.6-0.8-0.9C26.9,7.1,26,7,25.3,7.7
          c-0.5,0.5-1,1.2-1.3,1.9c-0.7,2.1-1.2,4.3-1.9,6.5l5.5,0.8l-0.4,1.5L21.9,17.6"
      />
    </svg>
  );
}

// ─── Keyframes ────────────────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes exitFade {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes starTwinkle {
    0%, 100% { opacity: 0.07; transform: scale(1); }
    50%       { opacity: 0.65; transform: scale(1.6); }
  }
  @keyframes letterReveal {
    from { opacity: 0; transform: translateY(30px) scale(0.88); filter: blur(10px); }
    to   { opacity: 1; transform: translateY(0) scale(1);       filter: blur(0); }
  }
  @keyframes goldenGlow {
    0%, 100% { text-shadow: 0 0 22px rgba(245,217,106,0.45), 0 0 60px rgba(245,217,106,0.18), 0 2px 4px rgba(0,0,0,0.6); }
    50%       { text-shadow: 0 0 36px rgba(245,217,106,0.8),  0 0 90px rgba(245,217,106,0.35), 0 2px 4px rgba(0,0,0,0.6); }
  }
  @keyframes subtitleReveal {
    from { opacity: 0; letter-spacing: 0.7em; }
    to   { opacity: 1; letter-spacing: 0.38em; }
  }
  @keyframes taglineReveal {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes buttonReveal {
    from { opacity: 0; transform: translateY(16px) scale(0.9); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
  @keyframes buttonPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245,217,106,0.1), inset 0 0 10px rgba(245,217,106,0.03); }
    50%       { box-shadow: 0 0 22px 5px rgba(245,217,106,0.18), inset 0 0 20px rgba(245,217,106,0.07); }
  }
  @keyframes ringExpand {
    0%   { transform: scale(0);   opacity: 0.9; }
    100% { transform: scale(5.5); opacity: 0; }
  }
  @keyframes flashBurst {
    0%   { opacity: 0; transform: scale(0.15); }
    28%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(2); }
  }
  @keyframes captionIn {
    0%   { opacity: 0; transform: translateY(6px); }
    15%  { opacity: 1; transform: translateY(0); }
    78%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes logoAppear {
    from { opacity: 0; transform: scale(0.3); filter: blur(12px) drop-shadow(0 0 0px rgba(245,217,106,0)); }
    to   { opacity: 1; transform: scale(1);   filter: blur(0)   drop-shadow(0 0 18px rgba(245,217,106,0.7)); }
  }
  @keyframes logoPulse {
    0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 12px rgba(245,217,106,0.65)) drop-shadow(0 0 28px rgba(245,217,106,0.3)); }
    50%       { transform: scale(1.08); filter: drop-shadow(0 0 22px rgba(245,217,106,0.95)) drop-shadow(0 0 55px rgba(245,217,106,0.55)); }
  }
  @keyframes logoConverge {
    0%   { transform: scale(1);    filter: drop-shadow(0 0 18px rgba(245,217,106,0.7)) drop-shadow(0 0 40px rgba(245,217,106,0.4)); }
    100% { transform: scale(1.25); filter: drop-shadow(0 0 35px rgba(255,240,150,1.0)) drop-shadow(0 0 80px rgba(245,217,106,0.8)); }
  }
  @keyframes logoExplode {
    0%   { opacity: 1; transform: scale(1.25); }
    100% { opacity: 0; transform: scale(4);    filter: blur(14px); }
  }
  @keyframes orbitSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes orbitPulse {
    0%, 100% { opacity: 0.25; }
    50%       { opacity: 0.55; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export function LoadingScreen({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [visibleLetters, setVisibleLetters] = useState(0);
  const [showExplosion, setShowExplosion] = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const phaseRef   = useRef(0);

  // ── Phase timeline ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = [
      setTimeout(() => { setPhase(1); phaseRef.current = 1; }, 250),   // nodes appear
      setTimeout(() => { setPhase(2); phaseRef.current = 2; }, 2400),  // edges + packets
      setTimeout(() => { setPhase(3); phaseRef.current = 3; }, 4200),  // converge
      setTimeout(() => { setShowExplosion(true); },             5100),  // flash
      setTimeout(() => { setPhase(4); phaseRef.current = 4; }, 5500),  // title
      setTimeout(() => { setPhase(5); phaseRef.current = 5; }, 6900),  // tagline
      setTimeout(() => { setPhase(6); phaseRef.current = 6; }, 7900),  // button
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  // ── Letter stagger — fires only once when phase becomes 4 ──────────────────
  useEffect(() => {
    if (phase !== 4) return;
    let n = 0;
    const iv = setInterval(() => {
      n++;
      setVisibleLetters(n);
      if (n >= TITLE.length) clearInterval(iv);
    }, 115);
    return () => clearInterval(iv);
  }, [phase]);

  // ── Canvas network animation ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startMs = performance.now();

    // Build nodes
    interface NetworkNode {
      x: number; y: number; vx: number; vy: number;
      r: number; type: NodeType;
      cr: number; cg: number; cb: number;   // colour RGB
      birthMs: number; opacity: number;
      trail: Array<{ x: number; y: number }>;
    }

    const NODE_COUNT = 54;
    const W0 = window.innerWidth;
    const H0 = window.innerHeight;
    const cx0 = W0 / 2;
    const cy0 = H0 / 2;

    const nodes: NetworkNode[] = Array.from({ length: NODE_COUNT }, (_, i) => {
      const type: NodeType = i < 37 ? "agent" : i < 49 ? "validator" : "storage";
      const p = NODE_PALETTE[type];
      // Scatter away from center initially
      let x: number, y: number;
      do {
        x = 60 + Math.random() * (W0 - 120);
        y = 60 + Math.random() * (H0 - 120);
      } while (Math.abs(x - cx0) < 130 && Math.abs(y - cy0) < 100);
      return {
        x, y,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        r: 2.2 + Math.random() * 2.6,
        type, cr: p.r, cg: p.g, cb: p.b,
        birthMs: 250 + i * 48,
        opacity: 0,
        trail: [],
      };
    });

    // Data packets
    interface Packet { fi: number; ti: number; t: number; speed: number; cr: number; cg: number; cb: number; }
    let packets: Packet[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Offscreen hex grid (drawn once, composited cheaply each frame)
    const hexCanvas = document.createElement("canvas");
    hexCanvas.width  = W0;
    hexCanvas.height = H0;
    const hx = hexCanvas.getContext("2d")!;
    const HEX = 42;
    const HH  = HEX * Math.sqrt(3);
    hx.strokeStyle = "rgba(245,217,106,0.045)";
    hx.lineWidth   = 0.5;
    for (let col = -1; col < W0 / (HEX * 1.5) + 2; col++) {
      for (let row = -1; row < H0 / HH + 2; row++) {
        const hpx = col * HEX * 1.5;
        const hpy = row * HH + (col % 2) * HH / 2;
        hx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
          const px = hpx + HEX * Math.cos(a);
          const py = hpy + HEX * Math.sin(a);
          k === 0 ? hx.moveTo(px, py) : hx.lineTo(px, py);
        }
        hx.closePath();
        hx.stroke();
      }
    }

    function frame(now: number) {
      if (!canvas || !ctx) return;
      const elapsed = now - startMs;
      const p = phaseRef.current;
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      // Hex grid — only during network phase
      if (p <= 3) {
        ctx.globalAlpha = Math.min(1, elapsed / 800) * (p < 3 ? 1 : Math.max(0, 1 - (elapsed - 4200) / 800));
        ctx.drawImage(hexCanvas, 0, 0);
        ctx.globalAlpha = 1;
      }

      // ── Update + draw nodes ───────────────────────────────────────────────
      nodes.forEach((node) => {
        if (elapsed < node.birthMs) return;
        node.opacity = Math.min(1, node.opacity + 0.032);

        if (p < 3) {
          // Gentle drift with soft boundary bounce
          node.x += node.vx;
          node.y += node.vy;
          if (node.x < 40 || node.x > W - 40) { node.vx *= -1; node.x = Math.max(40, Math.min(W - 40, node.x)); }
          if (node.y < 40 || node.y > H - 40) { node.vy *= -1; node.y = Math.max(40, Math.min(H - 40, node.y)); }
        } else if (p === 3) {
          // Accelerate toward center, leave a trail
          const dx = cx - node.x;
          const dy = cy - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 2) {
            // Ease-in acceleration over the convergence window
            const conv = Math.min(1, (elapsed - 4200) / 900);
            const speed = 0.025 + conv * 0.1;
            node.x += dx * speed;
            node.y += dy * speed;
            node.trail.push({ x: node.x, y: node.y });
            if (node.trail.length > 14) node.trail.shift();
          }
          const d2 = Math.sqrt((cx - node.x) ** 2 + (cy - node.y) ** 2);
          if (d2 < 90) node.opacity = Math.max(0, node.opacity - 0.05);
        }
      });

      if (p < 4) {
        const MAX_EDGE = 185;

        // ── Edges ───────────────────────────────────────────────────────────
        if (p >= 2) {
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].opacity < 0.08) continue;
            for (let j = i + 1; j < nodes.length; j++) {
              if (nodes[j].opacity < 0.08) continue;
              const dx = nodes[j].x - nodes[i].x;
              const dy = nodes[j].y - nodes[i].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < MAX_EDGE) {
                const alpha = ((1 - dist / MAX_EDGE) * 0.38 * Math.min(nodes[i].opacity, nodes[j].opacity)).toFixed(3);
                ctx.beginPath();
                ctx.moveTo(nodes[i].x, nodes[i].y);
                ctx.lineTo(nodes[j].x, nodes[j].y);
                ctx.strokeStyle = `rgba(245,217,106,${alpha})`;
                ctx.lineWidth = 0.65;
                ctx.stroke();
              }
            }
          }
        }

        // ── Convergence trails ───────────────────────────────────────────────
        if (p === 3) {
          nodes.forEach((node) => {
            if (node.trail.length < 2) return;
            for (let t = 1; t < node.trail.length; t++) {
              const a = ((t / node.trail.length) * 0.35).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(node.trail[t - 1].x, node.trail[t - 1].y);
              ctx.lineTo(node.trail[t].x, node.trail[t].y);
              ctx.strokeStyle = `rgba(${node.cr},${node.cg},${node.cb},${a})`;
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }
          });
        }

        // ── Data packets ─────────────────────────────────────────────────────
        if (p === 2) {
          // Spawn
          if (packets.length < 32 && Math.random() < 0.09) {
            const live = nodes.filter((n) => n.opacity > 0.5);
            if (live.length >= 2) {
              const a = live[Math.floor(Math.random() * live.length)];
              const b = live[Math.floor(Math.random() * live.length)];
              if (a !== b) {
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                if (dx * dx + dy * dy < MAX_EDGE * MAX_EDGE) {
                  packets.push({
                    fi: nodes.indexOf(a), ti: nodes.indexOf(b),
                    t: 0, speed: 0.006 + Math.random() * 0.009,
                    cr: a.cr, cg: a.cg, cb: a.cb,
                  });
                }
              }
            }
          }
          // Update + draw
          packets = packets.filter((pkt) => {
            pkt.t += pkt.speed;
            if (pkt.t >= 1) return false;
            const fn = nodes[pkt.fi]; const tn = nodes[pkt.ti];
            if (!fn || !tn || fn.opacity < 0.1 || tn.opacity < 0.1) return false;
            const px = fn.x + (tn.x - fn.x) * pkt.t;
            const py = fn.y + (tn.y - fn.y) * pkt.t;
            // Glow halo
            const grd = ctx.createRadialGradient(px, py, 0, px, py, 6);
            grd.addColorStop(0, `rgba(${pkt.cr},${pkt.cg},${pkt.cb},0.8)`);
            grd.addColorStop(1, "rgba(0,0,0,0)");
            ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = grd; ctx.fill();
            // Core
            ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.fill();
            return true;
          });
        }

        // ── Node dots ────────────────────────────────────────────────────────
        nodes.forEach((node) => {
          if (node.opacity <= 0) return;
          // Outer glow
          const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 7);
          grd.addColorStop(0,   `rgba(${node.cr},${node.cg},${node.cb},${(0.55 * node.opacity).toFixed(3)})`);
          grd.addColorStop(0.4, `rgba(${node.cr},${node.cg},${node.cb},${(0.18 * node.opacity).toFixed(3)})`);
          grd.addColorStop(1,   `rgba(${node.cr},${node.cg},${node.cb},0)`);
          ctx.beginPath(); ctx.arc(node.x, node.y, node.r * 7, 0, Math.PI * 2);
          ctx.fillStyle = grd; ctx.fill();
          // Core
          ctx.beginPath(); ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${node.cr},${node.cg},${node.cb},${node.opacity.toFixed(3)})`;
          ctx.fill();
          // Bright centre pinpoint
          ctx.beginPath(); ctx.arc(node.x, node.y, node.r * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${(0.7 * node.opacity).toFixed(3)})`;
          ctx.fill();
        });
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleEnter = () => { setExiting(true); setTimeout(onEnter, 750); };

  // Caption rotates with each phase
  const captions: Record<number, string> = {
    1: "AGENTS AWAKENING",
    2: "NETWORK SYNCHRONIZING",
    3: "CONVERGING ON FILCRAFT",
  };
  const caption = captions[phase] ?? null;

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Root */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at 50% 60%, #0c0818 0%, #06040e 45%, #0a0804 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        animation: exiting ? "exitFade 0.75s ease forwards" : undefined,
      }}>

        {/* Stars */}
        {STARS.map((s, i) => (
          <div key={i} style={{
            position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: "50%",
            background: s.size === 3 ? "#b8a060" : "#606880",
            opacity: 0,
            animation: `starTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }} />
        ))}

        {/* Network canvas */}
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

        {/* Phase caption */}
        {caption && (
          <div key={phase} style={{
            position: "absolute", bottom: "11%", left: 0, right: 0,
            textAlign: "center",
            fontFamily: CINZEL,
            fontSize: "0.52rem",
            letterSpacing: "0.45em",
            color: "rgba(168,144,96,0.55)",
            textTransform: "uppercase",
            animation: "captionIn 2.8s ease forwards",
            pointerEvents: "none",
          }}>
            {caption}
          </div>
        )}

        {/* Legend — tiny, bottom-left, phases 1-3 */}
        {phase >= 1 && phase <= 3 && (
          <div style={{
            position: "absolute", bottom: "11%", left: "4%",
            display: "flex", flexDirection: "column", gap: 6,
            opacity: phase <= 3 ? 0.6 : 0, transition: "opacity 0.6s ease",
            pointerEvents: "none",
          }}>
            {(["agent", "validator", "storage"] as NodeType[]).map((type) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: NODE_PALETTE[type].hex, boxShadow: `0 0 6px ${NODE_PALETTE[type].hex}` }} />
                <span style={{ fontFamily: CINZEL, fontSize: "0.42rem", letterSpacing: "0.25em", color: NODE_PALETTE[type].hex, textTransform: "uppercase" }}>
                  {type === "agent" ? "Agents" : type === "validator" ? "Validators" : "Storage"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Filecoin logo — center attractor ── */}
        {phase >= 2 && !showExplosion && (
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 5 }}>
            {/* Orbit rings — appear on convergence */}
            {phase === 3 && (
              <>
                <div style={{
                  position: "absolute", inset: -38, borderRadius: "50%",
                  border: "1px solid rgba(245,217,106,0.22)",
                  animation: "orbitPulse 1.4s ease-in-out infinite",
                }} />
                <div style={{
                  position: "absolute", inset: -62, borderRadius: "50%",
                  border: "1px dashed rgba(245,217,106,0.12)",
                  animation: "orbitSpin 8s linear infinite, orbitPulse 2s ease-in-out infinite",
                }}>
                  {/* Orbiting dot */}
                  <div style={{
                    position: "absolute", top: "50%", right: -4,
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#f5d96a",
                    boxShadow: "0 0 8px rgba(245,217,106,0.9)",
                    transform: "translateY(-50%)",
                  }} />
                </div>
                <div style={{
                  position: "absolute", inset: -90, borderRadius: "50%",
                  border: "0.5px solid rgba(245,217,106,0.07)",
                  animation: "orbitSpin 14s linear infinite reverse",
                }} />
              </>
            )}
            {/* Logo itself */}
            <div style={{
              animation: phase === 2
                ? "logoAppear 0.9s cubic-bezier(0.22,1,0.36,1) both, logoPulse 2.2s ease-in-out 0.9s infinite"
                : "logoConverge 0.9s ease forwards",
            }}>
              <FilecoinLogo size={76} />
            </div>
          </div>
        )}

        {/* Logo explodes outward as the flash fires */}
        {showExplosion && (
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 5 }}>
            <div style={{ animation: "logoExplode 0.6s ease forwards" }}>
              <FilecoinLogo size={76} />
            </div>
          </div>
        )}

        {/* Explosion rings + flash */}
        {showExplosion && (
          <>
            {[0, 0.08, 0.18, 0.3].map((delay, i) => (
              <div key={i} style={{
                position: "absolute",
                width: 60 + i * 20, height: 60 + i * 20,
                borderRadius: "50%",
                border: `${1.8 - i * 0.3}px solid rgba(245,217,106,${0.9 - i * 0.18})`,
                animation: `ringExpand 0.9s cubic-bezier(0.2,1,0.3,1) ${delay}s forwards`,
              }} />
            ))}
            <div style={{
              position: "absolute",
              width: "55vmin", height: "55vmin",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,253,230,0.96) 0%, rgba(245,217,106,0.55) 22%, rgba(200,130,20,0.18) 55%, transparent 78%)",
              animation: "flashBurst 0.75s cubic-bezier(0.2,1,0.3,1) forwards",
            }} />
          </>
        )}

        {/* Title / Tagline / Button */}
        <div style={{
          position: "relative", textAlign: "center", padding: "0 28px",
          opacity: phase >= 4 ? 1 : 0,
          transition: "opacity 0.55s ease",
        }}>
          {/* Eyebrow with tiny logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 22,
            animation: phase >= 4 ? "subtitleReveal 1.3s cubic-bezier(0.22,1,0.36,1) both" : "none",
          }}>
            <div style={{ filter: "drop-shadow(0 0 4px rgba(245,217,106,0.5))", flexShrink: 0 }}>
              <FilecoinLogo size={18} />
            </div>
            <p style={{
              fontFamily: CINZEL, fontSize: "0.57rem", color: "#a89060",
              textTransform: "uppercase", margin: 0, letterSpacing: "0.38em",
            }}>
              Filecoin Agent Economy
            </p>
            <div style={{ filter: "drop-shadow(0 0 4px rgba(245,217,106,0.5))", flexShrink: 0 }}>
              <FilecoinLogo size={18} />
            </div>
          </div>

          {/* Title letters */}
          <h1 style={{
            fontFamily: CINZEL,
            fontSize: "clamp(58px, 11vw, 108px)",
            fontWeight: 900, color: "#f5d96a",
            margin: 0, letterSpacing: "0.07em", lineHeight: 1,
          }}>
            {TITLE.split("").map((char, i) => (
              <span key={i} style={{
                display: "inline-block",
                visibility: i < visibleLetters ? "visible" : "hidden",
                animation: i < visibleLetters
                  ? `letterReveal 0.5s cubic-bezier(0.22,1,0.36,1) both,
                     goldenGlow 3.8s ease-in-out ${0.55 + i * 0.07}s infinite`
                  : "none",
              }}>
                {char}
              </span>
            ))}
          </h1>

          {/* Tagline */}
          <p style={{
            marginTop: 22, fontFamily: CINZEL,
            fontSize: "clamp(11px, 1.2vw, 13px)", letterSpacing: "0.14em", color: "#a89060",
            animation: phase >= 5 ? "taglineReveal 0.9s cubic-bezier(0.22,1,0.36,1) both" : "none",
            opacity: phase >= 5 ? 1 : 0,
          }}>
            Agent-native marketplace for the Filecoin economy
          </p>

          {/* Button */}
          {phase >= 6 && (
            <div style={{ marginTop: 48 }}>
              <button
                onClick={handleEnter}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(245,217,106,0.1)";
                  e.currentTarget.style.color = "#fff8d6";
                  e.currentTarget.style.letterSpacing = "0.28em";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(245,217,106,0.04)";
                  e.currentTarget.style.color = "#f5d96a";
                  e.currentTarget.style.letterSpacing = "0.24em";
                }}
                style={{
                  border: "1px solid rgba(245,217,106,0.45)",
                  color: "#f5d96a",
                  background: "rgba(245,217,106,0.04)",
                  fontFamily: CINZEL,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  padding: "14px 54px",
                  cursor: "pointer",
                  animation: "buttonReveal 0.7s cubic-bezier(0.22,1,0.36,1) both, buttonPulse 3s ease-in-out 0.8s infinite",
                  transition: "background 0.22s ease, color 0.22s ease, letter-spacing 0.22s ease",
                }}
              >
                Enter FilCraft
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
