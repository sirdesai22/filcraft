"use client";

import { useState, useEffect } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const TITLE = "FilCraft";
const CINZEL = "var(--font-cinzel, Cinzel, serif)";

// Deterministic stars (avoids SSR/client hydration mismatch)
const STARS = Array.from({ length: 90 }, (_, i) => {
  const s = (i * 2654435761) >>> 0;
  const x = ((s * 1664525 + 1013904223) >>> 0) % 10000 / 100;
  const y = ((s * 22695477 + 1) >>> 0) % 10000 / 100;
  const size = (i % 3) + 1;
  const delay = (s % 5000) / 1000;
  const dur = 2 + (s % 4);
  return { x, y, size, delay, dur };
});

// ─── SVG Components ───────────────────────────────────────────────────────────

function RobotSVG() {
  return (
    <svg
      width="64"
      height="92"
      viewBox="0 0 64 92"
      style={{ overflow: "visible", display: "block" }}
    >
      {/* Antenna */}
      <rect x="29" y="0" width="6" height="10" fill="#1a1208" />
      <circle cx="32" cy="1" r="4.5" fill="#f5d96a" />
      <circle cx="32" cy="1" r="2" fill="#fff8e0" />

      {/* Head */}
      <rect x="8" y="10" width="48" height="30" rx="5" fill="#1a1208" stroke="#a89060" strokeWidth="1.5" />
      {/* Head highlight */}
      <rect x="10" y="12" width="44" height="8" rx="3" fill="rgba(245,217,106,0.06)" />

      {/* Eyes */}
      <rect x="14" y="19" width="13" height="11" rx="2.5" fill="#f5d96a" />
      <rect x="37" y="19" width="13" height="11" rx="2.5" fill="#f5d96a" />
      {/* Pupils */}
      <rect x="18" y="21.5" width="5" height="6" rx="1.5" fill="#0a0804" />
      <rect x="41" y="21.5" width="5" height="6" rx="1.5" fill="#0a0804" />
      {/* Eye shine */}
      <rect x="22" y="22" width="2" height="2" rx="0.5" fill="rgba(255,255,255,0.6)" />
      <rect x="45" y="22" width="2" height="2" rx="0.5" fill="rgba(255,255,255,0.6)" />

      {/* Mouth */}
      <rect x="22" y="35" width="20" height="2.5" rx="1.2" fill="#a89060" />

      {/* Neck */}
      <rect x="25" y="40" width="14" height="7" rx="2" fill="#120d06" />

      {/* Body */}
      <rect x="5" y="47" width="54" height="32" rx="5" fill="#1a1208" stroke="#a89060" strokeWidth="1.5" />
      {/* Body highlight */}
      <rect x="7" y="49" width="50" height="6" rx="3" fill="rgba(245,217,106,0.05)" />

      {/* Chest panel */}
      <rect x="17" y="55" width="30" height="17" rx="3" fill="#0f0a04" stroke="rgba(168,144,96,0.35)" strokeWidth="1" />
      {/* Filecoin emblem */}
      <circle cx="32" cy="63.5" r="6" fill="rgba(245,217,106,0.1)" stroke="#f5d96a" strokeWidth="0.9" />
      <text x="32" y="67.5" textAnchor="middle" fill="#f5d96a" fontSize="7.5" fontWeight="bold" fontFamily="Cinzel,serif">F</text>

      {/* Side indicator lights */}
      <circle cx="10" cy="58" r="2.5" fill="#f5d96a" opacity="0.6" />
      <circle cx="54" cy="58" r="2.5" fill="#f5d96a" opacity="0.6" />

      {/* Arms */}
      <rect x="0" y="49" width="5" height="24" rx="2.5" fill="#1a1208" stroke="#a89060" strokeWidth="1" />
      <rect x="59" y="49" width="5" height="24" rx="2.5" fill="#1a1208" stroke="#a89060" strokeWidth="1" />
      {/* Arm joints */}
      <circle cx="2.5" cy="49" r="2.5" fill="#2a1f08" stroke="#a89060" strokeWidth="0.8" />
      <circle cx="61.5" cy="49" r="2.5" fill="#2a1f08" stroke="#a89060" strokeWidth="0.8" />

      {/* Legs */}
      <rect x="13" y="79" width="14" height="13" rx="3" fill="#1a1208" stroke="#a89060" strokeWidth="1" />
      <rect x="37" y="79" width="14" height="13" rx="3" fill="#1a1208" stroke="#a89060" strokeWidth="1" />
      {/* Feet */}
      <rect x="10" y="88" width="20" height="4" rx="2" fill="#2a1f08" stroke="#a89060" strokeWidth="0.6" />
      <rect x="34" y="88" width="20" height="4" rx="2" fill="#2a1f08" stroke="#a89060" strokeWidth="0.6" />
    </svg>
  );
}

function StoreSVG() {
  return (
    <svg width="140" height="178" viewBox="0 0 140 178" style={{ overflow: "visible", display: "block" }}>
      {/* Ground glow */}
      <ellipse cx="70" cy="172" rx="55" ry="8" fill="rgba(245,217,106,0.07)" />

      {/* Main building */}
      <rect x="5" y="62" width="130" height="116" rx="2" fill="#120d06" stroke="#a89060" strokeWidth="1.5" />

      {/* Roof */}
      <polygon points="0,62 140,62 128,28 12,28" fill="#1a1208" stroke="#f5d96a" strokeWidth="1.5" />
      {/* Roof detail lines */}
      <line x1="12" y1="28" x2="5" y2="62" stroke="rgba(168,144,96,0.3)" strokeWidth="0.8" />
      <line x1="128" y1="28" x2="135" y2="62" stroke="rgba(168,144,96,0.3)" strokeWidth="0.8" />

      {/* Fascia sign */}
      <rect x="24" y="32" width="92" height="22" rx="3" fill="#0f0a04" stroke="rgba(245,217,106,0.55)" strokeWidth="1" />
      <text x="70" y="47" textAnchor="middle" fill="#f5d96a" fontSize="10" fontFamily="Cinzel,serif" letterSpacing="2">FILCOIN</text>

      {/* Large F coin on rooftop */}
      <circle cx="70" cy="20" r="18" fill="#f5d96a" stroke="#c8a820" strokeWidth="2" />
      <circle cx="70" cy="20" r="13" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
      <text x="70" y="26" textAnchor="middle" fill="#0a0804" fontSize="15" fontWeight="bold" fontFamily="Cinzel,serif">F</text>

      {/* Left window */}
      <rect x="12" y="80" width="38" height="30" rx="3" fill="rgba(245,217,106,0.05)" stroke="#a89060" strokeWidth="1" />
      <line x1="31" y1="80" x2="31" y2="110" stroke="rgba(168,144,96,0.35)" strokeWidth="0.8" />
      <line x1="12" y1="95" x2="50" y2="95" stroke="rgba(168,144,96,0.35)" strokeWidth="0.8" />
      {/* Window glow */}
      <rect x="14" y="82" width="15" height="12" rx="1.5" fill="rgba(245,217,106,0.04)" />

      {/* Right window */}
      <rect x="90" y="80" width="38" height="30" rx="3" fill="rgba(245,217,106,0.05)" stroke="#a89060" strokeWidth="1" />
      <line x1="109" y1="80" x2="109" y2="110" stroke="rgba(168,144,96,0.35)" strokeWidth="0.8" />
      <line x1="90" y1="95" x2="128" y2="95" stroke="rgba(168,144,96,0.35)" strokeWidth="0.8" />
      <rect x="92" y="82" width="15" height="12" rx="1.5" fill="rgba(245,217,106,0.04)" />

      {/* Door */}
      <rect x="48" y="122" width="44" height="56" rx="3" fill="#0a0804" stroke="#a89060" strokeWidth="1" />
      {/* Door arch detail */}
      <path d="M48,142 Q70,120 92,142" fill="none" stroke="rgba(168,144,96,0.5)" strokeWidth="0.8" />
      {/* Door center line */}
      <line x1="70" y1="122" x2="70" y2="178" stroke="rgba(168,144,96,0.25)" strokeWidth="0.6" />
      {/* Door knobs */}
      <circle cx="84" cy="152" r="2.5" fill="#f5d96a" opacity="0.8" />
      <circle cx="56" cy="152" r="2.5" fill="#f5d96a" opacity="0.8" />

      {/* Step */}
      <rect x="40" y="172" width="60" height="6" rx="2" fill="#1a1208" stroke="#a89060" strokeWidth="0.6" />

      {/* Corner pillars */}
      <rect x="5" y="62" width="8" height="116" fill="#1a1208" stroke="#a89060" strokeWidth="0.5" />
      <rect x="127" y="62" width="8" height="116" fill="#1a1208" stroke="#a89060" strokeWidth="0.5" />
    </svg>
  );
}

function TokenSVG() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="17" fill="#f5d96a" stroke="#c8a820" strokeWidth="2" />
      <circle cx="19" cy="19" r="12" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
      <text x="19" y="24.5" textAnchor="middle" fill="#0a0804" fontSize="15" fontWeight="bold" fontFamily="Cinzel,serif">F</text>
    </svg>
  );
}

// ─── CSS Keyframes ─────────────────────────────────────────────────────────────
//
// robotJourney: 6.3s covers walk-in (0→3s), idle at store (3→4.7s), walk-out (4.7→6.3s)
//   Phase 2 fires at t=0.7s; phase 6 fires at t=7.0s = 0.7 + 6.3 ✓
//   Keyframe %: walk-in end = 3/6.3 = 47.6%, walk-out start = 4.7/6.3 = 74.6%
//
// Token: store coin center is at SVG x=70, y=20 (18px from top).
//   Store left: 52%, bottom: 28%. Coin bottom = 28% + (178-20) = 28% + 158px.
//   Token positioned at left:calc(52%+51px), bottom:calc(28%+140px).
//   Robot at left:30%, body center ≈ 30% + 32px, ≈ 28% + 64px.
//   Token translate: ≈ -22vw right, +76px down.

const KEYFRAMES = `
  @keyframes exitFade {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  @keyframes starTwinkle {
    0%, 100% { opacity: 0.12; transform: scale(1); }
    50%       { opacity: 0.75; transform: scale(1.6); }
  }

  @keyframes storeReveal {
    from { opacity: 0; transform: scaleY(0); transform-origin: bottom center; }
    to   { opacity: 1; transform: scaleY(1); transform-origin: bottom center; }
  }

  @keyframes robotJourney {
    0%    { transform: translateX(-130vw); animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
    47.6% { transform: translateX(0);      animation-timing-function: linear; }
    74.6% { transform: translateX(0);      animation-timing-function: cubic-bezier(0.4, 0, 1, 1); }
    100%  { transform: translateX(130vw); }
  }

  @keyframes robotBob {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
  }

  @keyframes tokenFly {
    0%   { opacity: 0; transform: translate(0, 0)       scale(0.3) rotate(0deg);   }
    10%  { opacity: 1; transform: translate(-1vw, -28px) scale(1.4) rotate(14deg);  }
    78%  { opacity: 1; transform: translate(-20vw, 58px) scale(1)   rotate(-8deg);  }
    90%  { opacity: 0.5; transform: translate(-21vw, 72px) scale(0.6) rotate(-14deg); }
    100% { opacity: 0; transform: translate(-22vw, 76px) scale(0)   rotate(-20deg); }
  }

  @keyframes letterReveal {
    from { opacity: 0; transform: translateY(20px); filter: blur(6px); }
    to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
  }

  @keyframes goldenGlow {
    0%, 100% {
      text-shadow:
        0 0 20px rgba(245,217,106,0.45),
        0 0 55px rgba(245,217,106,0.18),
        0 2px 4px rgba(0,0,0,0.5);
    }
    50% {
      text-shadow:
        0 0 32px rgba(245,217,106,0.75),
        0 0 80px rgba(245,217,106,0.32),
        0 2px 4px rgba(0,0,0,0.5);
    }
  }

  @keyframes subtitleReveal {
    from { opacity: 0; letter-spacing: 0.6em; }
    to   { opacity: 1; letter-spacing: 0.38em; }
  }

  @keyframes taglineReveal {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes buttonReveal {
    from { opacity: 0; transform: translateY(12px) scale(0.93); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }

  @keyframes buttonGlow {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(245,217,106,0.15), inset 0 0 12px rgba(245,217,106,0.04);
    }
    50% {
      box-shadow: 0 0 18px 3px rgba(245,217,106,0.18), inset 0 0 22px rgba(245,217,106,0.08);
    }
  }

  @keyframes groundPulse {
    0%, 100% { opacity: 0.25; }
    50%       { opacity: 0.5; }
  }
`;

// ─── Main Component ────────────────────────────────────────────────────────────

export function LoadingScreen({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [visibleLetters, setVisibleLetters] = useState(0);

  // Phase timeline — deliberately long to cover 3D asset loading
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),   // stars + store appear
      setTimeout(() => setPhase(2), 700),   // robot starts walking in
      setTimeout(() => setPhase(3), 3700),  // robot arrives at store
      setTimeout(() => setPhase(4), 4400),  // token flies (robot "grabs" it)
      setTimeout(() => setPhase(5), 5500),  // robot walks out
      setTimeout(() => setPhase(6), 7000),  // scene fades → title reveals
      setTimeout(() => setPhase(7), 8300),  // tagline fades in
      setTimeout(() => setPhase(8), 9200),  // button appears
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Stagger title letter reveal starting at phase 6
  useEffect(() => {
    if (phase < 6) return;
    let count = 0;
    const iv = setInterval(() => {
      count++;
      setVisibleLetters(count);
      if (count >= TITLE.length) clearInterval(iv);
    }, 135);
    return () => clearInterval(iv);
  }, [phase]);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(onEnter, 750);
  };

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Root overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "linear-gradient(180deg, #06040a 0%, #0a0804 40%, #0c0906 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          animation: exiting ? "exitFade 0.75s ease forwards" : undefined,
        }}
      >
        {/* ── Stars ── */}
        {STARS.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: s.size === 3 ? "#f5d96a" : "#c8a820",
              opacity: 0,
              animation: `starTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}

        {/* ── Scene (robot story) — fades out at phase 6 ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: phase >= 6 ? 0 : 1,
            transition: "opacity 1.3s ease",
            pointerEvents: "none",
          }}
        >
          {/* Ground line */}
          <div
            style={{
              position: "absolute",
              bottom: "28%",
              left: 0,
              right: 0,
              height: 1,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(245,217,106,0.12) 15%, rgba(245,217,106,0.32) 50%, rgba(245,217,106,0.12) 85%, transparent 100%)",
              animation: "groundPulse 3s ease-in-out infinite",
            }}
          />

          {/* Store — appears at phase 1 */}
          {phase >= 1 && (
            <div
              style={{
                position: "absolute",
                bottom: "28%",
                left: "52%",
                transformOrigin: "bottom center",
                animation: "storeReveal 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards",
              }}
            >
              <StoreSVG />
            </div>
          )}

          {/* Robot — mounts at phase 2, single animation handles full journey */}
          {phase >= 2 && (
            <div
              style={{
                position: "absolute",
                bottom: "28%",
                left: "30%",
                // 6.3s covers: walk-in (3s) + idle (1.7s) + walk-out (1.6s)
                animation: "robotJourney 6.3s linear forwards",
              }}
            >
              {/* Inner div bobs continuously — looks like walking & excited idle */}
              <div style={{ animation: "robotBob 0.34s ease-in-out infinite" }}>
                <RobotSVG />
              </div>
            </div>
          )}

          {/* Filecoin token — arcs from store coin to robot during phase 4 */}
          {phase === 4 && (
            <div
              style={{
                position: "absolute",
                // Store at left:52%, coin center at SVG x=70 → left: calc(52% + 51px)
                // Coin SVG y=20, store height=178, so 158px above ground → bottom: calc(28% + 140px)
                bottom: "calc(28% + 140px)",
                left: "calc(52% + 51px)",
                animation: "tokenFly 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
              }}
            >
              <TokenSVG />
            </div>
          )}

          {/* Caption text during robot story */}
          <div
            style={{
              position: "absolute",
              bottom: "12%",
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: CINZEL,
              fontSize: "0.6rem",
              letterSpacing: "0.3em",
              color: "rgba(168,144,96,0.5)",
              textTransform: "uppercase",
              transition: "opacity 0.5s ease",
              opacity: phase >= 1 && phase < 6 ? 1 : 0,
            }}
          >
            {phase <= 2 && "Agent incoming…"}
            {phase === 3 && "Acquiring Filecoin data…"}
            {phase === 4 && "Filecoin artifact secured"}
            {phase === 5 && "Deploying to the network…"}
          </div>
        </div>

        {/* ── Title / Tagline / Button — fades in at phase 6 ── */}
        <div
          style={{
            position: "relative",
            textAlign: "center",
            padding: "0 24px",
            opacity: phase >= 6 ? 1 : 0,
            transition: "opacity 0.9s ease",
          }}
        >
          {/* Eyebrow label */}
          <p
            style={{
              fontFamily: CINZEL,
              fontSize: "0.58rem",
              color: "#a89060",
              textTransform: "uppercase",
              marginBottom: 22,
              animation:
                phase >= 6
                  ? "subtitleReveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) both"
                  : "none",
              letterSpacing: "0.38em",
            }}
          >
            Filecoin Agent Economy
          </p>

          {/* FilCraft title */}
          <h1
            style={{
              fontFamily: CINZEL,
              fontSize: "clamp(58px, 11vw, 108px)",
              fontWeight: 900,
              color: "#f5d96a",
              margin: 0,
              letterSpacing: "0.07em",
              lineHeight: 1,
            }}
          >
            {TITLE.split("").map((char, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  visibility: i < visibleLetters ? "visible" : "hidden",
                  animation:
                    i < visibleLetters
                      ? `letterReveal 0.45s cubic-bezier(0.22, 1, 0.36, 1) both,
                         goldenGlow 3.5s ease-in-out ${0.5 + i * 0.06}s infinite`
                      : "none",
                }}
              >
                {char}
              </span>
            ))}
          </h1>

          {/* Tagline */}
          <p
            style={{
              marginTop: 20,
              fontFamily: CINZEL,
              fontSize: "clamp(11px, 1.2vw, 13px)",
              letterSpacing: "0.14em",
              color: "#a89060",
              animation:
                phase >= 7
                  ? "taglineReveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) both"
                  : "none",
              opacity: phase >= 7 ? 1 : 0,
            }}
          >
            Agent-native marketplace for the Filecoin economy
          </p>

          {/* Enter button */}
          {phase >= 8 && (
            <div style={{ marginTop: 46 }}>
              <button
                onClick={handleEnter}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(245,217,106,0.11)";
                  e.currentTarget.style.color = "#fff8d6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(245,217,106,0.04)";
                  e.currentTarget.style.color = "#f5d96a";
                }}
                style={{
                  border: "1px solid rgba(245,217,106,0.5)",
                  color: "#f5d96a",
                  background: "rgba(245,217,106,0.04)",
                  fontFamily: CINZEL,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  fontSize: "0.66rem",
                  padding: "14px 52px",
                  cursor: "pointer",
                  animation:
                    "buttonReveal 0.65s cubic-bezier(0.22, 1, 0.36, 1) both, buttonGlow 2.8s ease-in-out 0.7s infinite",
                  transition: "background 0.25s ease, color 0.25s ease",
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
