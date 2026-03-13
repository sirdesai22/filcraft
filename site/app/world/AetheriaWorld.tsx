"use client";

/**
 * AetheriaWorld — Living World interface for the Agent Economy.
 * Three.js game world with real economy data bindings.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import type {
  AgentEconomyAccount,
  EconomyEvent,
  EconomySummary,
} from "@/lib/economy";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentRow {
  agentId: string;
  networkId: string;
  name: string;
  economy: AgentEconomyAccount;
  completedRuns: number;
}

interface DashboardData {
  summary: EconomySummary;
  agentRows: AgentRow[];
  events: EconomyEvent[];
  fetchedAt: string;
}

const DEFAULT_NETWORK = "filecoinCalibration";

// All agents are on Filecoin Calibration — spawn near that fire (0, 0)
const AGENT_CONFIG: Record<
  string,
  { displayName: string; emoji: string; type: string; spawnNear: [number, number] }
> = {
  "12": {
    displayName: "SEO Agent",
    emoji: "⛏️",
    type: "Worker",
    spawnNear: [0, 0], // Filecoin Calibration
  },
  "13": {
    displayName: "Investor Finder",
    emoji: "🔮",
    type: "Shaman",
    spawnNear: [0, 0], // Filecoin Calibration
  },
  "14": {
    displayName: "Competitor Analyser",
    emoji: "⚔️",
    type: "Warrior",
    spawnNear: [0, 0], // Filecoin Calibration
  },
};

// Campfire positions and network labels — agents spawn at their chain's fire
const CAMPFIRE_CONFIG = [
  { x: 0, z: 0, label: "Filecoin Calibration", chainId: "314159", networkId: "filecoinCalibration" },
  { x: -20, z: 15, label: "Ethereum Sepolia", chainId: "11155111", networkId: "sepolia" },
  { x: 18, z: -8, label: "Base Sepolia", chainId: "84532", networkId: "baseSepolia" },
];
const NETWORK_TO_FIRE = Object.fromEntries(CAMPFIRE_CONFIG.map((c) => [c.networkId, [c.x, c.z] as [number, number]]));

function formatTFil(wei: string | bigint): string {
  const n = typeof wei === "string" ? BigInt(wei) : wei;
  if (n === 0n) return "0";
  const eth = Number(n) / 1e18;
  return eth < 0.001 ? eth.toExponential(2) : eth.toFixed(4);
}

function formatUsd(cents: string | bigint): string {
  const n = typeof cents === "string" ? BigInt(cents) : cents;
  return (Number(n) / 100).toFixed(2);
}

function eventDescription(event: EconomyEvent): string {
  switch (event.type) {
    case "BudgetDeposited":
      return `Agent #${event.agentId} received ${formatTFil(event.data.amount ?? "0")} tFIL`;
    case "StorageCostRecorded":
      return `Agent #${event.agentId} stored artifact — ${formatTFil(event.data.costWei ?? "0")} tFIL`;
    case "RevenueRecorded":
      return `Agent #${event.agentId} earned $${formatUsd(event.data.usdCents ?? "0")}`;
    case "AgentWindDown":
      return `Agent #${event.agentId} wound down`;
    default:
      return "";
  }
}

export function AetheriaWorld({
  initialData,
}: {
  initialData: DashboardData;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<DashboardData>(initialData);
  const [data, setData] = useState<DashboardData>(initialData);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/economy?network=${DEFAULT_NETWORK}`);
      if (res.ok) {
        const fresh = (await res.json()) as DashboardData;
        dataRef.current = fresh;
        setData(fresh);
        setLastRefresh(new Date());
      }
    } catch {
      // keep stale data
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;

    const loadThreeAndInit = (): Promise<unknown> => {
      return new Promise((resolve) => {
        if (typeof window !== "undefined" && (window as unknown as { THREE?: unknown }).THREE) {
          resolve((window as unknown as { THREE: unknown }).THREE);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        script.async = true;
        script.onload = () => {
          resolve((window as unknown as { THREE: unknown }).THREE);
        };
        document.head.appendChild(script);
      });
    };

    let cancelled = false;
    let rafId: number;

    loadThreeAndInit().then((THREE) => {
      if (cancelled) return;
      initWorld(THREE, containerRef.current!, dataRef, setSelectedAgentId);
      setLoading(false);
      rafId = requestAnimationFrame(function loop() {
        if (cancelled) return;
        (containerRef.current as unknown as { __aetheriaLoop?: () => void })?.__aetheriaLoop?.();
        rafId = requestAnimationFrame(loop);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      (containerRef.current as unknown as { __aetheriaCleanup?: () => void })?.__aetheriaCleanup?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- init once

  const selectedRow = selectedAgentId ? data.agentRows.find((r) => r.agentId === selectedAgentId) : null;
  const selectedCfg = selectedRow
    ? (AGENT_CONFIG[selectedRow.agentId] ?? {
        displayName: selectedRow.name,
        emoji: "🤖",
        type: "Agent",
        spawnNear: [0, 0] as [number, number],
      })
    : null;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0f]">
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=MedievalSharp&display=swap"
        rel="stylesheet"
      />
      {loading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-[100] transition-opacity duration-800"
          style={{ fontFamily: "MedievalSharp, cursive" }}
        >
          <h1
            className="font-black text-[42px] text-[#f5d96a] tracking-[10px]"
            style={{
              fontFamily: "Cinzel, serif",
              textShadow: "0 0 40px rgba(245,217,106,0.4)",
            }}
          >
            AETHERIA
          </h1>
          <p className="text-[#5a4a2a] tracking-[4px] mt-2 text-xs">
            ENTERING THE LIVING WORLD
          </p>
          <div className="w-[300px] h-1 bg-[#1a1510] mt-8 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#5a4a2a] to-[#f5d96a] rounded"
              style={{ width: 0, animation: "loadBar 2s ease forwards" }}
            />
          </div>
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0" />

      {/* HUD overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ fontFamily: "MedievalSharp, cursive" }}
      >
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-center">
          <h1
            className="font-black text-[26px] text-[#f5d96a] tracking-[6px] uppercase"
            style={{
              fontFamily: "Cinzel, serif",
              textShadow: "0 0 20px rgba(245,217,106,0.5), 0 2px 4px rgba(0,0,0,0.8)",
            }}
          >
            Aetheria
          </h1>
          <div className="text-[10px] text-[#a89060] tracking-[4px] mt-0.5">
            Agent Economy
          </div>
        </div>

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="text-xs text-[#a89060] tracking-[1px]">
            Agents: <span className="text-[#f5d96a] font-bold text-base" style={{ fontFamily: "Cinzel, serif" }} id="pop-count">{data.agentRows.length}</span>
            {" · "}
            Storage: <span className="text-[#e8a030]" id="stockpile-count">0</span> tFIL
          </div>
          <button
            type="button"
            onClick={() => setShowAllAgents(true)}
            className="w-7 h-7 rounded-full border border-[#5a4a2a] flex items-center justify-center text-[#a89060] hover:text-[#f5d96a] hover:border-[#f5d96a] transition-colors pointer-events-auto"
            title="View all agents"
            aria-label="View all agents"
          >
            ℹ
          </button>
        </div>

        {/* Scoreboard panel */}
        <div
          id="scoreboard-panel"
          className="absolute top-12 right-12 w-[280px] pointer-events-auto rounded-md border border-[#5a4a2a] p-3"
          style={{
            background: "linear-gradient(135deg, rgba(20,15,10,0.95), rgba(30,25,15,0.92))",
            boxShadow: "0 4px 30px rgba(0,0,0,0.6)",
          }}
        >
          <div className="text-center text-[#f5d96a] font-bold text-sm mb-2 tracking-wider" style={{ fontFamily: "Cinzel, serif" }}>
            AGENT ECONOMY SCOREBOARD
          </div>
          <div className="border-t border-[#5a4a2a]/50 pt-2 space-y-1 text-[10px]">
            {data.agentRows
              .sort((a, b) => Number(BigInt(b.economy.totalSpent) - BigInt(a.economy.totalSpent)))
              .map((row) => {
                const cfg = AGENT_CONFIG[row.agentId];
                return (
                  <div key={row.agentId} className="flex justify-between items-center text-[#c0b090]">
                    <span>
                      {cfg?.emoji ?? "🤖"} {cfg?.displayName ?? row.name}
                    </span>
                    <span className="tabular-nums">
                      {row.completedRuns} runs · ${formatUsd(row.economy.totalEarned)} · {formatTFil(row.economy.totalSpent)} tFIL
                    </span>
                  </div>
                );
              })}
          </div>
          <div className="border-t border-[#5a4a2a]/50 pt-2 mt-2 text-[10px] text-[#a89060]">
            Total: {formatTFil(data.summary.totalStorageCostWei)} tFIL · ${formatUsd(data.summary.totalRevenueUsdCents)} revenue
          </div>
          <div className="flex gap-2 mt-1 text-[9px]">
            <span className="text-emerald-500">Healthy: {data.summary.activeAgents}</span>
            <span className="text-amber-500">At-Risk: {data.summary.atRiskAgents}</span>
            <span className="text-zinc-400">Wound: {data.summary.windDownCount}</span>
          </div>
          {lastRefresh && (
            <div className="text-[8px] text-[#504030] mt-1">
              Refreshed {Math.round((Date.now() - lastRefresh.getTime()) / 1000)}s ago
            </div>
          )}
        </div>

        {/* Activity log */}
        <div
          id="activity-log"
          className="absolute bottom-16 right-12 w-[280px] max-h-[180px] overflow-y-auto pointer-events-auto scrollbar-thin"
          style={{ scrollbarColor: "#5a4a2a transparent" }}
        >
          {data.events.slice(0, 15).map((ev, i) => (
            <div
              key={i}
              className="py-1 px-2 text-[10px] text-[#a09070] border-b border-[#5a4a2a]/20"
            >
              <span className="text-[#f5d96a] font-bold">#{ev.agentId}</span>{" "}
              <span className="text-[#7aaa7a]">{eventDescription(ev)}</span>
            </div>
          ))}
        </div>

        {/* All agents list dialog */}
        {showAllAgents && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/50 pointer-events-auto"
              onClick={() => setShowAllAgents(false)}
              aria-hidden="true"
            />
            <div
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[min(440px,92vw)] max-h-[85vh] pointer-events-auto"
              style={{ fontFamily: "MedievalSharp, cursive" }}
              role="dialog"
              aria-labelledby="all-agents-dialog-title"
            >
              <div
                className="rounded-lg overflow-hidden border-2 border-[#5a4a2a] flex flex-col max-h-[85vh]"
                style={{
                  background: "linear-gradient(180deg, #2a2318 0%, #1c180f 50%, #151210 100%)",
                  boxShadow: "0 0 0 1px #7a6a3a, 0 0 40px rgba(0,0,0,0.8), inset 0 0 60px rgba(90,74,42,0.08)",
                }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#5a4a2a]/60 shrink-0" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <h2 id="all-agents-dialog-title" className="text-[#f5d96a] font-bold text-lg tracking-wider" style={{ fontFamily: "Cinzel, serif" }}>
                    ALL AGENTS
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAllAgents(false)}
                    className="w-8 h-8 rounded border border-[#5a4a2a] flex items-center justify-center text-[#a89060] hover:text-[#f5d96a] hover:border-[#f5d96a] transition-colors"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="overflow-y-auto p-4 space-y-2">
                  {data.agentRows
                    .sort((a, b) => Number(BigInt(b.economy.totalSpent) - BigInt(a.economy.totalSpent)))
                    .map((row) => {
                      const cfg = AGENT_CONFIG[row.agentId];
                      return (
                        <button
                          key={row.agentId}
                          type="button"
                          onClick={() => {
                            setSelectedAgentId(row.agentId);
                            setShowAllAgents(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded border border-[#5a4a2a]/50 text-left hover:border-[#f5d96a]/50 hover:bg-[#5a4a2a]/20 transition-colors"
                          style={{ background: "rgba(0,0,0,0.25)" }}
                        >
                          <div
                            className="w-10 h-10 rounded-lg border border-[#7a6a3a] flex items-center justify-center text-xl shrink-0"
                            style={{ background: `#${((cfg?.type ?? "Worker") === "Worker" ? 0x8a6a3a : (cfg?.type ?? "") === "Shaman" ? 0x6a3a8a : 0x4a7a3a).toString(16).padStart(6, "0")}44` }}
                          >
                            {cfg?.emoji ?? "🤖"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[#f5d96a] font-bold" style={{ fontFamily: "Cinzel, serif" }}>
                              {cfg?.displayName ?? row.name}
                            </div>
                            <div className="text-[10px] text-[#a89060]">
                              #{row.agentId} · {row.completedRuns} runs · ${formatUsd(row.economy.totalEarned)} · {formatTFil(row.economy.totalSpent)} tFIL
                            </div>
                          </div>
                          <span
                            className={`text-[10px] shrink-0 ${
                              row.economy.status === "healthy" ? "text-emerald-500" : row.economy.status === "at-risk" ? "text-amber-500" : "text-zinc-400"
                            }`}
                          >
                            {row.economy.status}
                          </span>
                        </button>
                      );
                    })}
                </div>
                <div className="px-4 py-2 border-t border-[#5a4a2a]/50 text-[10px] text-[#a89060] shrink-0" style={{ background: "rgba(0,0,0,0.2)" }}>
                  Click an agent to view details
                </div>
              </div>
            </div>
          </>
        )}

        {/* Agent detail dialog — in-game style */}
        {selectedRow && selectedCfg && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/50 pointer-events-auto"
              onClick={() => setSelectedAgentId(null)}
              aria-hidden="true"
            />
            <div
              id="agent-dialog"
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[min(420px,90vw)] pointer-events-auto"
              style={{ fontFamily: "MedievalSharp, cursive" }}
              role="dialog"
              aria-labelledby="agent-dialog-title"
            >
              <div
                className="rounded-lg overflow-hidden border-2 border-[#5a4a2a]"
                style={{
                  background: "linear-gradient(180deg, #2a2318 0%, #1c180f 50%, #151210 100%)",
                  boxShadow: "0 0 0 1px #7a6a3a, 0 0 40px rgba(0,0,0,0.8), inset 0 0 60px rgba(90,74,42,0.08)",
                }}
              >
                {/* Header with close */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#5a4a2a]/60" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <h2 id="agent-dialog-title" className="text-[#f5d96a] font-bold text-lg tracking-wider" style={{ fontFamily: "Cinzel, serif" }}>
                    AGENT SCRYING
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedAgentId(null)}
                    className="w-8 h-8 rounded border border-[#5a4a2a] flex items-center justify-center text-[#a89060] hover:text-[#f5d96a] hover:border-[#f5d96a] transition-colors"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Agent identity */}
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-lg border-2 border-[#7a6a3a] flex items-center justify-center text-[36px] shrink-0"
                      style={{ background: `#${(selectedCfg.type === "Worker" ? 0x8a6a3a : selectedCfg.type === "Shaman" ? 0x6a3a8a : selectedCfg.type === "Warrior" ? 0x4a7a3a : 0x5a5a5a).toString(16).padStart(6, "0")}44` }}
                    >
                      {selectedCfg.emoji}
                    </div>
                    <div>
                      <div className="text-[#f5d96a] font-bold text-xl" style={{ fontFamily: "Cinzel, serif" }}>
                        {selectedCfg.displayName}
                      </div>
                      <div className="text-[#a89060] text-sm">
                        {selectedCfg.type} · Agent #{selectedRow.agentId}
                      </div>
                      <div className="text-xs mt-0.5">
                        <span
                          className={
                            selectedRow.economy.status === "healthy"
                              ? "text-emerald-500"
                              : selectedRow.economy.status === "at-risk"
                              ? "text-amber-500"
                              : "text-zinc-400"
                          }
                        >
                          {selectedRow.economy.status === "healthy" ? "● Healthy" : selectedRow.economy.status === "at-risk" ? "● At Risk" : "● Wound Down"}
                        </span>
                        {selectedRow.economy.windDown && <span className="text-zinc-500 ml-1">(stopped)</span>}
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded border border-[#5a4a2a]/50" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <div className="text-[9px] text-[#a89060] uppercase tracking-wider mb-0.5">Balance</div>
                      <div className="text-[#f5d96a] font-bold">{formatTFil(selectedRow.economy.balance)} tFIL</div>
                      <div className="h-1.5 bg-black/50 rounded overflow-hidden mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-[#2a5a9a] to-[#4a8adf] rounded"
                          style={{ width: `${Math.min(100, (Number(BigInt(selectedRow.economy.balance)) / 1e18 / 0.005) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded border border-[#5a4a2a]/50" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <div className="text-[9px] text-[#a89060] uppercase tracking-wider mb-0.5">Completed Runs</div>
                      <div className="text-[#f5d96a] font-bold text-lg">{selectedRow.completedRuns}</div>
                    </div>
                    <div className="p-3 rounded border border-[#5a4a2a]/50" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <div className="text-[9px] text-[#a89060] uppercase tracking-wider mb-0.5">Revenue (USD)</div>
                      <div className="text-[#e8a030] font-bold">${formatUsd(selectedRow.economy.totalEarned)}</div>
                    </div>
                    <div className="p-3 rounded border border-[#5a4a2a]/50" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <div className="text-[9px] text-[#a89060] uppercase tracking-wider mb-0.5">Storage Cost</div>
                      <div className="text-[#44aacc] font-bold">{formatTFil(selectedRow.economy.totalSpent)} tFIL</div>
                    </div>
                  </div>

                  {/* Last activity */}
                  {selectedRow.economy.lastActivity > 0 && (
                    <div className="text-[11px] text-[#a89060]">
                      Last activity: {new Date(selectedRow.economy.lastActivity * 1000).toLocaleString()}
                    </div>
                  )}

                  {/* Status message */}
                  <div className="p-3 rounded border-l-2 border-[#5a4a2a]" style={{ background: "rgba(0,0,0,0.3)" }}>
                    <p className="text-[#c0b090] text-sm italic">
                      {selectedRow.economy.status === "healthy"
                        ? "Running strong. Balance above minimum viable."
                        : selectedRow.economy.status === "at-risk"
                        ? "Balance low. Consider topping up tFIL to avoid wind-down."
                        : "Wound down or depleted. No further runs until budget is restored."}
                    </p>
                  </div>

                  {/* Link to Memfil */}
                  <Link
                    href={`/agents/${selectedRow.networkId}/${selectedRow.agentId}`}
                    className="block w-full py-2 text-center rounded border border-[#5a4a2a] text-[#f5d96a] text-sm font-medium hover:bg-[#5a4a2a]/30 hover:border-[#f5d96a]/50 transition-colors"
                  >
                    View on Memfil →
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-[#504030] text-center"
          style={{ letterSpacing: "1px" }}
        >
          Left-click: select · Right-drag: rotate · Scroll: zoom · WASD: pan · Dbl-click: follow
        </div>
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

// ── Three.js world init (runs in useEffect) ────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- THREE loaded from CDN, no @types/three
function initWorld(
  THREE: any,
  container: HTMLDivElement,
  dataRef: React.MutableRefObject<DashboardData>,
  setSelectedAgentId: (id: string | null) => void
) {
  const initialData = dataRef.current;
  const WORLD_SIZE = 120;
  const H = (x: number, z: number) =>
    Math.sin(x * 0.05) * Math.cos(z * 0.07) * 2 +
    Math.sin(x * 0.12 + z * 0.08) * 1.5 +
    Math.cos(z * 0.03) * 3;

  const canvas = document.createElement("canvas");
  canvas.id = "game-canvas";
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1520, 0.012);
  scene.background = new THREE.Color(0x0d0a15);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);

  // Orbit camera
  const orbit = {
    target: new THREE.Vector3(0, 0, 0),
    smooth: new THREE.Vector3(0, 0, 0),
    dist: 45,
    tDist: 45,
    phi: Math.PI * 0.3,
    tPhi: Math.PI * 0.3,
    theta: Math.PI * 0.25,
    tTheta: Math.PI * 0.25,
    draggingRot: false,
    draggingPan: false,
    last: { x: 0, y: 0 },
  };

  function updateCamera() {
    orbit.dist += (orbit.tDist - orbit.dist) * 0.1;
    orbit.phi += (orbit.tPhi - orbit.phi) * 0.12;
    orbit.theta += (orbit.tTheta - orbit.theta) * 0.12;
    orbit.smooth.lerp(orbit.target, 0.08);
    const r = orbit.dist;
    camera.position.set(
      orbit.smooth.x + r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      orbit.smooth.y + r * Math.cos(orbit.phi),
      orbit.smooth.z + r * Math.sin(orbit.phi) * Math.cos(orbit.theta)
    );
    camera.lookAt(orbit.smooth);
  }

  // Input
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
      orbit.draggingRot = true;
      orbit.last = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
    }
    if (e.button === 1) {
      orbit.draggingPan = true;
      orbit.last = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "move";
      e.preventDefault();
    }
  });
  window.addEventListener("mousemove", (e) => {
    const dx = e.clientX - orbit.last.x;
    const dy = e.clientY - orbit.last.y;
    if (orbit.draggingRot) {
      orbit.tTheta -= dx * 0.005;
      orbit.tPhi = Math.max(0.1, Math.min(Math.PI * 0.48, orbit.tPhi - dy * 0.005));
      orbit.last = { x: e.clientX, y: e.clientY };
    }
    if (orbit.draggingPan) {
      const s = orbit.dist * 0.002;
      const sinT = Math.sin(orbit.theta);
      const cosT = Math.cos(orbit.theta);
      orbit.target.x += (-dx * cosT - dy * sinT) * s;
      orbit.target.z += (dx * sinT - dy * cosT) * s;
      orbit.last = { x: e.clientX, y: e.clientY };
    }
  });
  window.addEventListener("mouseup", () => {
    orbit.draggingRot = false;
    orbit.draggingPan = false;
    canvas.style.cursor = "default";
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      orbit.tDist = Math.max(8, Math.min(90, orbit.tDist * (1 + e.deltaY * 0.001)));
    },
    { passive: false }
  );

  const keys: Record<string, boolean> = {};
  window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
  window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

  function processKeys(dt: number) {
    const p = 20 * dt;
    const sinT = Math.sin(orbit.theta);
    const cosT = Math.cos(orbit.theta);
    let mx = 0;
    let mz = 0;
    if (keys["w"] || keys["arrowup"]) {
      mx -= sinT;
      mz -= cosT;
    }
    if (keys["s"] || keys["arrowdown"]) {
      mx += sinT;
      mz += cosT;
    }
    if (keys["a"] || keys["arrowleft"]) {
      mx -= cosT;
      mz += sinT;
    }
    if (keys["d"] || keys["arrowright"]) {
      mx += cosT;
      mz -= sinT;
    }
    if (mx || mz) {
      orbit.target.x += mx * p;
      orbit.target.z += mz * p;
    }
    if (keys["q"]) orbit.tTheta += 1.5 * dt;
    if (keys["e"]) orbit.tTheta -= 1.5 * dt;
  }

  // Lighting — enhanced for atmosphere
  scene.add(new THREE.AmbientLight(0x2a2040, 0.5));
  const hemiLight = new THREE.HemisphereLight(0x4466aa, 0x2a4a1a, 0.4);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.3);
  dirLight.position.set(30, 50, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(4096, 4096);
  dirLight.shadow.camera.left = -60;
  dirLight.shadow.camera.right = 60;
  dirLight.shadow.camera.top = 60;
  dirLight.shadow.camera.bottom = -60;
  dirLight.shadow.bias = -0.0001;
  scene.add(dirLight);
  const ml = new THREE.DirectionalLight(0x4466aa, 0.35);
  ml.position.set(-20, 40, -30);
  scene.add(ml);

  // Terrain — higher resolution, smoother
  const terrainGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 120, 120);
  terrainGeo.rotateX(-Math.PI / 2);
  const tv = terrainGeo.attributes.position;
  for (let i = 0; i < tv.count; i++) tv.setY(i, H(tv.getX(i), tv.getZ(i)));
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x2a4a1a,
    roughness: 0.85,
    metalness: 0.05,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Rocks — scattered boulders
  for (let i = 0; i < 45; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.82;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.82;
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.9, 1),
      new THREE.MeshStandardMaterial({
        color: 0x555555 + Math.floor(Math.random() * 0x222222),
        roughness: 0.95,
        flatShading: true,
      })
    );
    rock.position.set(x, H(x, z) + 0.25, z);
    rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.3);
    rock.scale.y = 0.5 + Math.random() * 0.6;
    rock.castShadow = true;
    scene.add(rock);
  }

  // Trees — more variety, higher poly
  for (let i = 0; i < 65; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
    // Keep clear of storage depot at (0, 35)
    if (Math.abs(x) < 12 && Math.abs(z - 35) < 10) continue;
    const treeG = new THREE.Group();
    const h = 2.2 + Math.random() * 3.5;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1 });
    const tr = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, h, 8),
      trunkMat
    );
    tr.position.y = h / 2;
    tr.castShadow = true;
    treeG.add(tr);
    const foliageColors = [0x1a5a1a, 0x2a6a2a, 0x1a4a1a, 0x2a5a2a];
    foliageColors.forEach((c, idx) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.9 - idx * 0.35, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
      );
      cone.position.y = h + idx * 0.9;
      cone.castShadow = true;
      treeG.add(cone);
    });
    treeG.position.set(x, H(x, z), z);
    treeG.rotation.y = Math.random() * Math.PI * 2;
    scene.add(treeG);
  }

  // Bushes — low foliage clusters
  for (let i = 0; i < 35; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
    if (Math.abs(x) < 12 && Math.abs(z - 35) < 10) continue;
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 + Math.random() * 0.5, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0x1a5a1a + Math.floor(Math.random() * 0x111111),
        roughness: 0.95,
      })
    );
    bush.position.set(x, H(x, z) + 0.2, z);
    bush.scale.y = 0.6 + Math.random() * 0.4;
    bush.castShadow = true;
    scene.add(bush);
  }

  // Water — pond
  const waterGeo = new THREE.PlaneGeometry(28, 22, 32, 32);
  waterGeo.rotateX(-Math.PI / 2);
  const wv = waterGeo.attributes.position;
  for (let i = 0; i < wv.count; i++) {
    const wx = wv.getX(i);
    const wz = wv.getZ(i);
    wv.setY(i, -0.4 + Math.sin(wx * 0.2) * 0.1 + Math.cos(wz * 0.25) * 0.08);
  }
  waterGeo.computeVertexNormals();
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      color: 0x1a3a5a,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.35,
    })
  );
  water.position.set(22, 0, -18);
  water.receiveShadow = true;
  scene.add(water);

  // Floating particles (fireflies / dust)
  const pCount = 120;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pVel: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
    pPos[i * 3 + 1] = 1 + Math.random() * 8;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
    pVel.push({ x: (Math.random() - 0.5) * 0.015, y: (Math.random() - 0.5) * 0.01, z: (Math.random() - 0.5) * 0.015 });
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: 0xffdd44, size: 0.18, transparent: true, opacity: 0.7 })
  );
  scene.add(particles);
  (scene as { userData: { particles?: typeof particles; pVel?: typeof pVel } }).userData.particles = particles;
  (scene as { userData: { pVel?: typeof pVel } }).userData.pVel = pVel;

  // Campfires with network labels
  type CampfireItem = { userData: { fireLight?: { intensity: number }; fireParticles?: { geometry: { attributes: { position: { count: number; array: Float32Array; needsUpdate?: boolean } } }; material: { opacity?: number } } } };
  const campfires: CampfireItem[] = [];
  CAMPFIRE_CONFIG.forEach((cfg) => {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.25, 0),
        new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true })
      );
      s.position.set(Math.cos(a), 0.1, Math.sin(a));
      g.add(s);
    }
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.2, 5),
        new THREE.MeshStandardMaterial({ color: 0x3a2510 })
      );
      l.rotation.z = Math.PI / 2;
      l.rotation.y = (i / 3) * Math.PI;
      l.position.y = 0.15;
      g.add(l);
    }
    const fpGeo = new THREE.BufferGeometry();
    const fpPos = new Float32Array(30 * 3);
    for (let i = 0; i < 30; i++) {
      fpPos[i * 3] = (Math.random() - 0.5) * 0.6;
      fpPos[i * 3 + 1] = Math.random() * 1.5 + 0.3;
      fpPos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    fpGeo.setAttribute("position", new THREE.BufferAttribute(fpPos, 3));
    const fpMat = new THREE.PointsMaterial({
      color: 0xff6622,
      size: 0.12,
      transparent: true,
      opacity: 0.8,
    });
    const fp = new THREE.Points(fpGeo, fpMat);
    g.add(fp);
    (g as { userData: { fireParticles: unknown } }).userData.fireParticles = fp;
    const fl = new THREE.PointLight(0xff4400, 2, 15);
    fl.position.y = 1;
    g.add(fl);
    (g as { userData: { fireLight: unknown } }).userData.fireLight = fl;
    g.position.set(cfg.x, H(cfg.x, cfg.z), cfg.z);
    scene.add(g);
    campfires.push(g as CampfireItem);

    // Label sprite
    const lc = document.createElement("canvas");
    lc.width = 256;
    lc.height = 64;
    const ctx = lc.getContext("2d")!;
    ctx.font = "bold 24px MedievalSharp";
    ctx.fillStyle = "#f5d96a";
    ctx.textAlign = "center";
    ctx.fillText(cfg.label, 128, 28);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a89060";
    ctx.fillText(`Chain ${cfg.chainId}`, 128, 48);
    const ls = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(lc),
        transparent: true,
        depthTest: false,
      })
    );
    ls.position.y = 4;
    ls.scale.set(6, 1.5, 1);
    g.add(ls);
  });

  // ── Storage Depot (Filecoin Onchain Cloud) at (0, 35) ────────────────────────
  const STORAGE_POS = { x: 0, z: 35 };
  const storageGroup = new THREE.Group();
  const ty = H(STORAGE_POS.x, STORAGE_POS.z);

  const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9, flatShading: true });
  const woodFloorMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.9, flatShading: true });
  const roofMat2 = new THREE.MeshStandardMaterial({ color: 0x362010, roughness: 0.95, flatShading: true });

  // Platform
  const platform = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 12), woodFloorMat);
  platform.position.y = 0.2;
  platform.receiveShadow = true;
  platform.castShadow = true;
  storageGroup.add(platform);

  // 6 vertical posts: x in {-7, 0, 7}, z in {-5, 5}
  const POST_H = 5.5;
  const postXs = [-7, 0, 7];
  const postZs = [-5, 5];
  postXs.forEach((px) => {
    postZs.forEach((pz) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, POST_H, 8), woodDarkMat);
      post.position.set(px, POST_H / 2 + 0.4, pz);
      post.castShadow = true;
      storageGroup.add(post);
    });
  });

  // Top longitudinal beams (along X, connecting posts at same Z)
  postZs.forEach((pz) => {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 14, 6), woodDarkMat);
    beam.rotation.z = Math.PI / 2; // horizontal along X
    beam.position.set(0, POST_H + 0.4, pz);
    beam.castShadow = true;
    storageGroup.add(beam);
  });

  // Top lateral beams (along Z, connecting posts at same X)
  postXs.forEach((px) => {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 10, 6), woodDarkMat);
    beam.rotation.x = Math.PI / 2; // horizontal along Z
    beam.position.set(px, POST_H + 0.4, 0);
    beam.castShadow = true;
    storageGroup.add(beam);
  });

  // Flat roof panel
  const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(16, 0.25, 11), roofMat2);
  roofPanel.position.set(0, POST_H + 0.65, 0);
  roofPanel.castShadow = true;
  roofPanel.receiveShadow = true;
  storageGroup.add(roofPanel);

  // Back wall planks (solid back wall to suggest a storage building)
  for (let row = 0; row < 5; row++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.8, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x4a3a22 + row * 0x050500, roughness: 0.9, flatShading: true })
    );
    plank.position.set(0, 0.65 + row * 0.85, -5);
    plank.castShadow = true;
    plank.receiveShadow = true;
    storageGroup.add(plank);
  }

  // ── Artifact tablets (reports/artifacts stored on Filecoin) ────────────────────
  const MAX_ARTIFACT_TABLETS = 30;
  const MIN_ARTIFACT_TABLETS = 6;
  const TABLET_W = 1.6;
  const TABLET_H = 0.25;
  const TABLET_D = 0.9;
  const AGENT_COLORS: Record<string, number> = {
    "12": 0x4a7ac4, // SEO Agent — blue
    "13": 0x8a4ac4, // Investor Finder — purple
    "14": 0x4ac48a, // Competitor Analyser — green
  };
  const DEFAULT_TABLET_COLOR = 0x8a8a8a;

  // 3 shelf planks inside the shed
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.9, flatShading: true });
  for (let s = 0; s < 3; s++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 0.8), shelfMat);
    shelf.position.set(0, 0.55 + s * 1.2, -4.2);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    storageGroup.add(shelf);
  }

  const tabletGroup = new THREE.Group();
  const artifactTablets: { mesh: unknown }[] = [];
  const agentIds = initialData.agentRows.map((r) => r.agentId);
  for (let i = 0; i < MAX_ARTIFACT_TABLETS; i++) {
    const agentId = agentIds[i % agentIds.length] ?? "12";
    const color = AGENT_COLORS[agentId] ?? DEFAULT_TABLET_COLOR;
    const tablet = new THREE.Mesh(
      new THREE.BoxGeometry(TABLET_W, TABLET_H, TABLET_D),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.15,
        flatShading: true,
      })
    );
    tablet.rotation.x = Math.PI / 2 - 0.15; // upright, leaning back slightly
    tablet.rotation.y = (i % 5) * 0.08 - 0.16; // slight stagger
    const shelfIdx = Math.floor(i / 10);
    const col = (i % 10) % 5;
    const row = Math.floor((i % 10) / 5);
    const px = -4 + col * 2.2 + row * 0.3;
    const py = 0.5 + shelfIdx * 1.2 + (i % 3) * 0.05;
    const pz = -4.1 - row * 0.5;
    tablet.position.set(px, py, pz);
    tablet.castShadow = true;
    tabletGroup.add(tablet);
    artifactTablets.push({ mesh: tablet });
  }
  storageGroup.add(tabletGroup);
  (storageGroup as { userData: { artifactTablets: typeof artifactTablets; minTablets: number } }).userData.artifactTablets = artifactTablets;
  (storageGroup as { userData: { minTablets: number } }).userData.minTablets = MIN_ARTIFACT_TABLETS;

  // ── Filecoin beacon at depot entrance ────────────────────────────────────────
  const beaconPost = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.5, 8), woodDarkMat);
  beaconPost.position.set(5, 1.65, 0);
  beaconPost.castShadow = true;
  storageGroup.add(beaconPost);
  const beaconSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x0088cc,
      emissive: 0x0088cc,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.2,
    })
  );
  beaconSphere.position.set(5, 3.4, 0);
  beaconSphere.castShadow = true;
  storageGroup.add(beaconSphere);
  const beaconLight = new THREE.PointLight(0x0088cc, 1.5, 25);
  beaconLight.position.set(5, 3.4, 0);
  storageGroup.add(beaconLight);
  (storageGroup as { userData: { beaconLight?: { intensity: number } } }).userData.beaconLight = beaconLight;

  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 128;
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: signTex, transparent: true, depthTest: false })
  );
  signSprite.position.y = 6;
  signSprite.scale.set(8, 2, 1);
  storageGroup.add(signSprite);
  storageGroup.position.set(STORAGE_POS.x, ty, STORAGE_POS.z);
  scene.add(storageGroup);

  // ── Data-stream particles (campfire → depot: "data flowing to Filecoin") ─────
  const STREAM_PARTICLE_COUNT = 40;
  const depotEnd = new THREE.Vector3(STORAGE_POS.x, ty + 2, STORAGE_POS.z);
  type DataStreamItem = {
    points: { geometry: { attributes: { position: { count: number; array: Float32Array; needsUpdate?: boolean } } }; material: { opacity?: number } };
    phases: number[];
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
  };
  const dataStreams: DataStreamItem[] = [];
  CAMPFIRE_CONFIG.forEach((cfg) => {
    const start = new THREE.Vector3(cfg.x, H(cfg.x, cfg.z) + 1.5, cfg.z);
    const phases: number[] = [];
    const posArray = new Float32Array(STREAM_PARTICLE_COUNT * 3);
    for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
      phases.push(i / STREAM_PARTICLE_COUNT);
      const t = phases[i];
      const x = start.x + (depotEnd.x - start.x) * t;
      const y = start.y + (depotEnd.y - start.y) * t;
      const z = start.z + (depotEnd.z - start.z) * t;
      posArray[i * 3] = x;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x44aaff,
        size: 0.12,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    scene.add(pts);
    dataStreams.push({ points: pts, phases, start, end: depotEnd.clone() });
  });
  (scene as { userData: { dataStreams?: DataStreamItem[] } }).userData.dataStreams = dataStreams;

  function updateStorageSign() {
    const summary = dataRef.current.summary;
    const ctx = signCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = "bold 36px MedievalSharp";
    ctx.fillStyle = "#e8a030";
    ctx.textAlign = "center";
    ctx.fillText("Filecoin Onchain Cloud", 256, 40);
    ctx.font = "24px MedievalSharp";
    ctx.fillStyle = "#f5d96a";
    ctx.fillText(
      `Storage: ${formatTFil(summary.totalStorageCostWei)} tFIL · Revenue: $${formatUsd(summary.totalRevenueUsdCents)}`,
      256,
      80
    );
    ctx.font = "16px MedievalSharp";
    ctx.fillStyle = "#b0a080";
    ctx.fillText(
      `Healthy: ${summary.activeAgents} · At-Risk: ${summary.atRiskAgents} · Wound: ${summary.windDownCount}`,
      256,
      108
    );
    signTex.needsUpdate = true;

    // Artifact tablets: count = sum of completedRuns across agents, min 6, max 30
    const totalRuns = dataRef.current.agentRows.reduce((s, r) => s + r.completedRuns, 0);
    const ud = (storageGroup as { userData: { artifactTablets: { mesh: { visible: boolean } }[]; minTablets: number } }).userData;
    const minTablets = ud.minTablets ?? 6;
    const visibleCount = Math.min(MAX_ARTIFACT_TABLETS, Math.max(minTablets, totalRuns));
    if (ud.artifactTablets) {
      ud.artifactTablets.forEach((entry, i) => {
        (entry.mesh as { visible: boolean }).visible = i < visibleCount;
      });
    }
  }
  updateStorageSign();

  // Agent creatures (3 only, driven by economy data)
  const DEFAULT_AGENT = { displayName: "", emoji: "🤖", type: "Worker", spawnNear: [0, 0] as [number, number] };

  interface AgentCreature {
    id: string;
    mesh: { position: { x: number; y: number; z: number }; rotation: { y: number } };
    x: number;
    z: number;
    y: number;
    facing: number;
    size: number;
    row: AgentRow;
    cfg: (typeof AGENT_CONFIG)[string] | typeof DEFAULT_AGENT;
  }

  const agentCreatures: AgentCreature[] = [];
  const FIRE_RING_RADIUS = 3.5; // agents circle around their network's fire
  const agentsByNetwork = new Map<string, AgentRow[]>();
  initialData.agentRows.forEach((row) => {
    const list = agentsByNetwork.get(row.networkId) ?? [];
    list.push(row);
    agentsByNetwork.set(row.networkId, list);
  });
  initialData.agentRows.forEach((row) => {
    const cfg = AGENT_CONFIG[row.agentId] ?? { ...DEFAULT_AGENT, displayName: row.name };
    const [sx, sz] = NETWORK_TO_FIRE[row.networkId] ?? cfg.spawnNear;
    const networkAgents = agentsByNetwork.get(row.networkId) ?? [row];
    const idxInNetwork = networkAgents.indexOf(row);
    const angle = (idxInNetwork / Math.max(1, networkAgents.length)) * Math.PI * 2;
    const x = sx + Math.cos(angle) * FIRE_RING_RADIUS + (Math.random() - 0.5) * 1;
    const z = sz + Math.sin(angle) * FIRE_RING_RADIUS + (Math.random() - 0.5) * 1;
    const y = H(x, z);
    const size = 0.65;
    const displayName = cfg.displayName || row.name;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: cfg.type === "Worker" ? 0x8a6a3a : cfg.type === "Shaman" ? 0x6a3a8a : 0x4a7a3a,
      roughness: 0.65,
      metalness: 0.05,
    });
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.6, 16, 12),
      bodyMat
    );
    body.position.y = size * 0.8;
    body.scale.y = 1.2;
    body.castShadow = true;
    g.add(body);
    const headMat = new THREE.MeshStandardMaterial({
      color: cfg.type === "Worker" ? 0xc4a060 : cfg.type === "Shaman" ? 0xaa6adf : 0x8aba6a,
      roughness: 0.55,
      metalness: 0.02,
    });
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.38, 14, 10),
      headMat
    );
    head.position.y = size * 1.65;
    head.castShadow = true;
    g.add(head);
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(size * 0.06, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffff88, emissive: 0xffff44, emissiveIntensity: 0.4 })
      );
      eye.position.set(side * size * 0.18, size * 1.7, size * 0.28);
      g.add(eye);
    });
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.1, size * 0.12, size * 0.55, 6),
        bodyMat
      );
      leg.position.set(side * size * 0.28, size * 0.28, 0);
      g.add(leg);
      if (side === -1) (g as { userData: { leftLeg?: unknown } }).userData.leftLeg = leg;
      else (g as { userData: { rightLeg?: unknown } }).userData.rightLeg = leg;
    });
    const lc = document.createElement("canvas");
    lc.width = 256;
    lc.height = 64;
    const ctx = lc.getContext("2d")!;
    ctx.font = "bold 28px MedievalSharp";
    ctx.fillStyle = "#f5d96a";
    ctx.textAlign = "center";
    ctx.fillText(displayName, 128, 30);
    ctx.font = "16px MedievalSharp";
    ctx.fillStyle = "#a89060";
    ctx.fillText(`#${row.agentId} · ${row.completedRuns} runs`, 128, 52);
    const ls = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(lc),
        transparent: true,
        depthTest: false,
      })
    );
    ls.position.y = size * 2.6;
    ls.scale.set(3, 0.75, 1);
    g.add(ls);
    g.position.set(x, y, z);
    g.userData = { creature: { id: row.agentId, row, cfg } };
    scene.add(g);
    agentCreatures.push({ id: row.agentId, mesh: g, x, z, y, facing: 0, size, row, cfg });
  });

  // Selection
  const ray = new THREE.Raycaster();
  const mVec = new THREE.Vector2();
  let selectedCreature: AgentCreature | null = null;
  const selRing = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.0, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xf5d96a,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })
  );
  selRing.visible = false;
  scene.add(selRing);

  canvas.addEventListener("click", (e) => {
    if (orbit.draggingRot || orbit.draggingPan) return;
    mVec.x = (e.clientX / window.innerWidth) * 2 - 1;
    mVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(mVec, camera);
    const hits = ray.intersectObjects(agentCreatures.map((c) => c.mesh), true);
    if (hits.length) {
      let o: unknown = hits[0].object;
      while ((o as { parent?: unknown }).parent && !(o as { userData?: { creature?: { id: string } } }).userData?.creature)
        o = (o as { parent: unknown }).parent;
      const cr = (o as { userData?: { creature?: { id: string } } }).userData?.creature;
      if (cr) {
        selectedCreature = agentCreatures.find((a) => a.id === cr.id) ?? null;
        setSelectedAgentId(cr.id);
      }
    } else {
      selectedCreature = null;
      setSelectedAgentId(null);
    }
  });

  // Game loop
  let lt = performance.now();
  function loop() {
    const now = performance.now();
    const dt = Math.min((now - lt) / 1000, 0.05);
    lt = now;
    processKeys(dt);
    updateCamera();
    const b = WORLD_SIZE * 0.45;
    agentCreatures.forEach((c) => {
      c.mesh.position.x = c.x;
      c.mesh.position.y = c.y + Math.sin(now * 0.003 + parseInt(c.id || "0") * 2) * 0.08;
      c.mesh.position.z = c.z;
      c.mesh.rotation.y = c.facing;
      const ud = (c.mesh as { userData?: { leftLeg?: { rotation: { x: number } }; rightLeg?: { rotation: { x: number } } } }).userData;
      if (ud?.leftLeg && ud?.rightLeg) {
        const sw = Math.sin(now * 0.008 + parseInt(c.id || "0")) * 0.35;
        ud.leftLeg.rotation.x = sw;
        ud.rightLeg.rotation.x = -sw;
      }
    });
    if (selectedCreature) {
      selRing.visible = true;
      selRing.position.set(selectedCreature.x, selectedCreature.y + 0.05, selectedCreature.z);
      selRing.scale.setScalar(selectedCreature.size * 1.5);
      selRing.rotation.y = now * 0.001;
    } else selRing.visible = false;
    campfires.forEach((cf) => {
      const ud = cf.userData as { fireLight?: { intensity: number }; fireParticles?: { geometry: { attributes: { position: { count: number; array: Float32Array; needsUpdate?: boolean } } }; material: { opacity?: number } } };
      if (ud.fireLight) ud.fireLight.intensity = 1.5 + Math.sin(now * 0.01) * 0.5 + Math.random() * 0.3;
      if (ud.fireParticles) {
        const fp = ud.fireParticles.geometry.attributes.position;
        for (let i = 0; i < fp.count; i++) {
          fp.array[i * 3 + 1] += 0.02;
          if (fp.array[i * 3 + 1] > 2) {
            fp.array[i * 3] = (Math.random() - 0.5) * 0.6;
            fp.array[i * 3 + 1] = 0.3;
            fp.array[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
          }
        }
        fp.needsUpdate = true;
      }
    });
    // Data streams: particles flow from campfires toward depot
    const dsUd = scene.userData as { dataStreams?: { points: { geometry: { attributes: { position: { count: number; array: Float32Array; needsUpdate?: boolean } } } }; phases: number[]; start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }[] };
    if (dsUd.dataStreams) {
      const speed = 0.15;
      dsUd.dataStreams.forEach((stream) => {
        const pp = stream.points.geometry.attributes.position;
        for (let i = 0; i < stream.phases.length; i++) {
          stream.phases[i] += dt * speed;
          if (stream.phases[i] > 1) stream.phases[i] -= 1;
          const t = stream.phases[i];
          const wobble = Math.sin(now * 0.003 + i * 0.5) * 0.4;
          pp.array[i * 3] = stream.start.x + (stream.end.x - stream.start.x) * t + Math.cos(i) * wobble;
          pp.array[i * 3 + 1] = stream.start.y + (stream.end.y - stream.start.y) * t + Math.sin(i * 0.7) * wobble * 0.5;
          pp.array[i * 3 + 2] = stream.start.z + (stream.end.z - stream.start.z) * t + Math.sin(i * 0.3) * wobble;
        }
        pp.needsUpdate = true;
      });
    }
    const sceneUd = scene.userData as { particles?: { geometry: { attributes: { position: { count: number; array: Float32Array; needsUpdate?: boolean } } }; material: { opacity?: number } }; pVel?: { x: number; y: number; z: number }[] };
    if (sceneUd.particles && sceneUd.pVel) {
      const pp = sceneUd.particles.geometry.attributes.position;
      for (let i = 0; i < sceneUd.pVel.length; i++) {
        pp.array[i * 3] += sceneUd.pVel[i].x;
        pp.array[i * 3 + 1] += sceneUd.pVel[i].y + Math.sin(now * 0.001 + i) * 0.002;
        pp.array[i * 3 + 2] += sceneUd.pVel[i].z;
        if (pp.array[i * 3 + 1] > 9 || pp.array[i * 3 + 1] < 1) sceneUd.pVel[i].y *= -1;
        if (pp.array[i * 3] > WORLD_SIZE * 0.45 || pp.array[i * 3] < -WORLD_SIZE * 0.45) sceneUd.pVel[i].x *= -1;
        if (pp.array[i * 3 + 2] > WORLD_SIZE * 0.45 || pp.array[i * 3 + 2] < -WORLD_SIZE * 0.45) sceneUd.pVel[i].z *= -1;
      }
      pp.needsUpdate = true;
      sceneUd.particles.material.opacity = 0.5 + Math.sin(now * 0.002) * 0.25;
    }
    if (water && water.geometry?.attributes?.position) {
      const wv = water.geometry.attributes.position;
      for (let i = 0; i < wv.count; i++) {
        wv.setY(i, -0.4 + Math.sin(wv.getX(i) * 0.3 + now * 0.001) * 0.12 + Math.cos(wv.getZ(i) * 0.4 + now * 0.0012) * 0.1);
      }
      wv.needsUpdate = true;
    }
    if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) {
      updateStorageSign();
      const stockEl = document.getElementById("stockpile-count");
      if (stockEl) stockEl.textContent = formatTFil(dataRef.current.summary.totalStorageCostWei);
    }
    renderer.render(scene, camera);
  }

  (container as unknown as { __aetheriaLoop: () => void }).__aetheriaLoop = loop;
  (container as unknown as { __aetheriaCleanup: () => void }).__aetheriaCleanup = () => {
    renderer.dispose();
    container.removeChild(canvas);
  };

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const stockEl = document.getElementById("stockpile-count");
  if (stockEl) stockEl.textContent = formatTFil(dataRef.current.summary.totalStorageCostWei);
}
