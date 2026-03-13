"use client";

/**
 * AetheriaWorld — Living World interface for the Agent Economy.
 * Three.js game world with real economy data bindings.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  { x: -10, z: 7.5, label: "Ethereum Sepolia", chainId: "11155111", networkId: "sepolia" },
  { x: 9, z: -4, label: "Base Sepolia", chainId: "84532", networkId: "baseSepolia" },
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
  const [scoreboardExpanded, setScoreboardExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [agentExtra, setAgentExtra] = useState<{
    creditScore?: number;
    tier?: string;
    artifactCount?: number;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!selectedAgentId) {
      setAgentExtra(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetch(`/api/agents/${selectedAgentId}/score?network=${DEFAULT_NETWORK}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/data-listings?agentId=${selectedAgentId}`).then((r) => (r.ok ? r.json() : { total: 0 })),
    ]).then(([scoreRes, listingsRes]) => {
      if (cancelled) return;
      setAgentExtra({
        creditScore: scoreRes?.score,
        tier: scoreRes?.label,
        artifactCount: listingsRes?.total ?? 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

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

    const loadThree = (): Promise<unknown> => {
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

    const loadGLTFLoader = (): Promise<unknown> => {
      return new Promise((resolve) => {
        if (typeof window !== "undefined" && (window as unknown as { THREE?: { GLTFLoader?: unknown } }).THREE?.GLTFLoader) {
          resolve(undefined);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
        script.async = true;
        script.onload = () => resolve(undefined);
        document.head.appendChild(script);
      });
    };

    const loadRobotModel = (THREE: { GLTFLoader: new () => { load: (url: string, onLoad: (gltf: unknown) => void, onProgress?: unknown, onError?: (err: unknown) => void) => void } }): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        loader.load(
          "/models/RobotExpressive.glb",
          (gltf) => resolve(gltf),
          undefined,
          (err) => reject(err)
        );
      });
    };

    let cancelled = false;
    let rafId: number;

    loadThree()
      .then((THREE) => {
        if (cancelled) return Promise.reject(new Error("cancelled"));
        return loadGLTFLoader().then(() => ({ THREE }));
      })
      .then(({ THREE }) => {
        if (cancelled) return Promise.reject(new Error("cancelled"));
        return loadRobotModel(THREE as Parameters<typeof loadRobotModel>[0]).then((gltf) => ({ THREE, gltf }));
      })
      .then(({ THREE, gltf }) => {
        if (cancelled) return;
        initWorld(THREE, containerRef.current!, dataRef, setSelectedAgentId, gltf as { scene: unknown; animations: { name: string }[] }, () => router.push("/marketplace"));
        setLoading(false);
        rafId = requestAnimationFrame(function loop() {
          if (cancelled) return;
          (containerRef.current as unknown as { __aetheriaLoop?: () => void })?.__aetheriaLoop?.();
          rafId = requestAnimationFrame(loop);
        });
      })
      .catch((err: unknown) => {
        if ((err as Error)?.message !== "cancelled") console.error(err);
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
                      {agentExtra?.tier && (
                        <div className="text-[10px] mt-0.5">
                          <span className="text-[#a89060]">Credit: </span>
                          <span className="text-[#f5d96a] font-semibold">{agentExtra.tier}</span>
                          {agentExtra.creditScore != null && (
                            <span className="text-[#7a8a6a] ml-1">({agentExtra.creditScore})</span>
                          )}
                        </div>
                      )}
                      {agentExtra?.artifactCount != null && (
                        <div className="text-[10px] mt-0.5">
                          <span className="text-[#a89060]">{agentExtra.artifactCount} artifact{agentExtra.artifactCount !== 1 ? "s" : ""} on marketplace</span>
                        </div>
                      )}
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

// Agent color config: active (healthy) vs inactive (unhealthy/wound-down)
const AGENT_COLORS_ACTIVE: Record<string, { primary: number; glow: number }> = {
  Worker: { primary: 0xf97316, glow: 0xfde68a },
  Shaman: { primary: 0x7c3aed, glow: 0xe879f9 },
  Warrior: { primary: 0x059669, glow: 0x6ee7b7 },
};
const AGENT_COLORS_INACTIVE: Record<string, { primary: number; glow: number }> = {
  Worker: { primary: 0x6b5a3a, glow: 0x4b4030 },
  Shaman: { primary: 0x3a2a4a, glow: 0x2a2030 },
  Warrior: { primary: 0x2a3a2a, glow: 0x202a20 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- THREE loaded from CDN, no @types/three
function initWorld(
  THREE: any,
  container: HTMLDivElement,
  dataRef: React.MutableRefObject<DashboardData>,
  setSelectedAgentId: (id: string | null) => void,
  gltf: { scene: any; animations: any[] },
  onStorageDepotClick: () => void
) {
  const initialData = dataRef.current;
  const WORLD_SIZE = 60;
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
  scene.fog = new THREE.FogExp2(0x1a1520, 0.024);
  scene.background = new THREE.Color(0x0d0a15);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);

  // Orbit camera
  const orbit = {
    target: new THREE.Vector3(0, 0, 0),
    smooth: new THREE.Vector3(0, 0, 0),
    dist: 28,
    tDist: 28,
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
      orbit.tDist = Math.max(6, Math.min(50, orbit.tDist * (1 + e.deltaY * 0.001)));
    },
    { passive: false }
  );

  const keys: Record<string, boolean> = {};
  window.addEventListener("keydown", (e) => {
    const k = e.key?.toLowerCase?.();
    if (k) keys[k] = true;
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key?.toLowerCase?.();
    if (k) keys[k] = false;
  });

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
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -35;
  dirLight.shadow.camera.right = 35;
  dirLight.shadow.camera.top = 35;
  dirLight.shadow.camera.bottom = -35;
  dirLight.shadow.bias = -0.0001;
  scene.add(dirLight);
  const ml = new THREE.DirectionalLight(0x4466aa, 0.35);
  ml.position.set(-20, 40, -30);
  scene.add(ml);

  // Terrain — higher resolution, smoother
  const terrainGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 80, 80);
  terrainGeo.rotateX(-Math.PI / 2);
  const tv = terrainGeo.attributes.position;
  for (let i = 0; i < tv.count; i++) tv.setY(i, H(tv.getX(i), tv.getZ(i)));
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a1a,
    roughness: 0.85,
    metalness: 0.05,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Rocks — 12 blue-grey crystalline boulders (sci-fi)
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.82;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.82;
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
    if (Math.abs(x) < 6 && Math.abs(z - 17.5) < 6) continue;
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.7, 0),
      new THREE.MeshStandardMaterial({
        color: 0x3a4a6a,
        roughness: 0.9,
        metalness: 0.15,
        flatShading: true,
      })
    );
    rock.position.set(x, H(x, z) + 0.2, z);
    rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.2);
    rock.scale.y = 0.6 + Math.random() * 0.5;
    rock.castShadow = true;
    scene.add(rock);
  }

  // Trees — 18 teal-blue-green (alien/tech flora)
  const foliageColors = [0x1a4a3a, 0x0a3a2a, 0x1a3a4a, 0x0a2a3a];
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    if (Math.abs(x) < 6 && Math.abs(z - 17.5) < 5) continue;
    const treeG = new THREE.Group();
    const h = 2.2 + Math.random() * 3;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 1 });
    const tr = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, h, 8),
      trunkMat
    );
    tr.position.y = h / 2;
    tr.castShadow = true;
    treeG.add(tr);
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

  // Water — pond
  const waterGeo = new THREE.PlaneGeometry(14, 11, 24, 24);
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
  water.position.set(11, 0, -9);
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
    new THREE.PointsMaterial({ color: 0x0090ff, size: 0.18, transparent: true, opacity: 0.5 })
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

  // ── Storage Depot (Filecoin Onchain Cloud) at (0, 17.5) — tech data-server look ──
  const FIL_BLUE = 0x0090ff;
  const STORAGE_POS = { x: 0, z: 17.5 };
  const storageGroup = new THREE.Group();
  const ty = H(STORAGE_POS.x, STORAGE_POS.z);

  // Materials — Filecoin data-centre
  const matFloor = new THREE.MeshStandardMaterial({ color: 0x0a1520, metalness: 0.9, roughness: 0.2, flatShading: true });
  const matWall = new THREE.MeshStandardMaterial({ color: 0x0d1e30, metalness: 0.8, roughness: 0.3, flatShading: true });
  const matRoof = new THREE.MeshStandardMaterial({ color: 0x071020, metalness: 0.95, roughness: 0.15, flatShading: true });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0x1a3a5a, metalness: 0.7, roughness: 0.4, flatShading: true });
  const matGlow = new THREE.MeshStandardMaterial({ color: FIL_BLUE, emissive: FIL_BLUE, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.2 });

  const POST_H = 3.2;

  // 1. Floor slab
  const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 7), matFloor);
  floor.position.y = 0.15;
  floor.receiveShadow = true;
  floor.castShadow = true;
  storageGroup.add(floor);

  // 2. Four walls
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(10, 3.5, 0.25), matWall);
  backWall.position.set(0, POST_H / 2 + 0.15, -3);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  storageGroup.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 7), matWall);
  leftWall.position.set(-5, POST_H / 2 + 0.15, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  storageGroup.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 7), matWall);
  rightWall.position.set(5, POST_H / 2 + 0.15, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  storageGroup.add(rightWall);

  // Front wall with doorway — two columns + lintel
  const frontColL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.5, 0.25), matWall);
  frontColL.position.set(-3.75, POST_H / 2 + 0.15, 3);
  frontColL.castShadow = true;
  storageGroup.add(frontColL);
  const frontColR = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.5, 0.25), matWall);
  frontColR.position.set(3.75, POST_H / 2 + 0.15, 3);
  frontColR.castShadow = true;
  storageGroup.add(frontColR);
  const frontLintel = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 0.25), matWall);
  frontLintel.position.set(0, POST_H - 0.3, 3);
  frontLintel.castShadow = true;
  storageGroup.add(frontLintel);

  // 3. Roof slab + rooftop ridge strip
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.35, 7.5), matRoof);
  roof.position.set(0, POST_H + 0.5, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  storageGroup.add(roof);
  const ridgeStrip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.3), matGlow);
  ridgeStrip.position.set(0, POST_H + 0.68, 0);
  storageGroup.add(ridgeStrip);

  // 4. Filecoin arch at entrance
  const archPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), matGlow);
  archPillarL.position.set(-1.8, 2.15, 3.3);
  archPillarL.castShadow = true;
  storageGroup.add(archPillarL);
  const archPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), matGlow);
  archPillarR.position.set(1.8, 2.15, 3.3);
  archPillarR.castShadow = true;
  storageGroup.add(archPillarR);
  const archBar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 0.4), matGlow);
  archBar.position.set(0, 4.15, 3.3);
  archBar.castShadow = true;
  storageGroup.add(archBar);

  // 5. Server racks inside + artifact tablets
  const MAX_ARTIFACT_TABLETS = 30;
  const MIN_ARTIFACT_TABLETS = 6;
  const TABLET_AGENT_COLORS: Record<string, number> = {
    "12": 0x4a7ac4,
    "13": 0x8a4ac4,
    "14": 0x4ac48a,
  };
  const DEFAULT_TABLET_COLOR = 0x8a8a8a;
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.9, roughness: 0.2, flatShading: true });
  const rackGlowMat = new THREE.MeshStandardMaterial({ color: FIL_BLUE, emissive: FIL_BLUE, emissiveIntensity: 1, roughness: 0.3, metalness: 0.2 });
  const tabletGroup = new THREE.Group();
  const artifactTablets: { mesh: unknown }[] = [];
  const agentIds = initialData.agentRows.map((r) => r.agentId);
  const rackXs = [-3, 0, 3];
  rackXs.forEach((rx, rackIdx) => {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 0.6), rackMat);
    rack.position.set(rx, 1.55, -2.5);
    rack.castShadow = true;
    storageGroup.add(rack);
    const rackFace = new THREE.Mesh(new THREE.BoxGeometry(1, 2.3, 0.05), rackGlowMat);
    rackFace.position.set(rx, 1.5, -2.2);
    storageGroup.add(rackFace);
    for (let i = 0; i < 10; i++) {
      const agentId = agentIds[(rackIdx * 10 + i) % agentIds.length] ?? "12";
      const color = TABLET_AGENT_COLORS[agentId] ?? DEFAULT_TABLET_COLOR;
      const tablet = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.05),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3, flatShading: true })
      );
      const col = i % 5;
      const row = Math.floor(i / 5);
      tablet.position.set(rx - 0.4 + col * 0.22, 0.5 + row * 0.5, -2.18);
      tablet.rotation.y = (i % 3) * 0.02;
      tabletGroup.add(tablet);
      artifactTablets.push({ mesh: tablet });
    }
  });
  storageGroup.add(tabletGroup);
  (storageGroup as { userData: { artifactTablets: typeof artifactTablets; minTablets: number } }).userData.artifactTablets = artifactTablets;
  (storageGroup as { userData: { minTablets: number } }).userData.minTablets = MIN_ARTIFACT_TABLETS;

  // 6. Blue LED floor strips (runway lights toward entrance)
  for (let i = 0; i < 2; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 0.1), matGlow);
    strip.position.set((i - 0.5) * 1.5, 0.2, 1.5);
    storageGroup.add(strip);
  }

  // 7. Filecoin logo sign — backlit panel on lintel
  const logoPanel = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.9, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x001a30, emissive: FIL_BLUE, emissiveIntensity: 0.5 })
  );
  logoPanel.position.set(0, POST_H - 0.5, 2.88);
  storageGroup.add(logoPanel);
  const filLogoCanvas = document.createElement("canvas");
  filLogoCanvas.width = 256;
  filLogoCanvas.height = 64;
  const filCtx = filLogoCanvas.getContext("2d")!;
  filCtx.fillStyle = "#0090ff";
  filCtx.fillRect(0, 0, 256, 64);
  filCtx.fillStyle = "#ffffff";
  filCtx.font = "bold 28px system-ui, sans-serif";
  filCtx.textAlign = "center";
  filCtx.fillText("⨎ Filecoin", 128, 40);
  const filLogoSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(filLogoCanvas), transparent: true, depthTest: false })
  );
  filLogoSprite.position.set(0, POST_H - 0.5, 2.95);
  filLogoSprite.scale.set(2, 0.5, 1);
  storageGroup.add(filLogoSprite);

  // 8. Lighting — interior PointLight + arch SpotLight
  const interiorLight = new THREE.PointLight(FIL_BLUE, 3, 18);
  interiorLight.position.set(0, POST_H - 0.5, 0);
  storageGroup.add(interiorLight);
  (storageGroup as { userData: { beaconLight?: { intensity: number } } }).userData.beaconLight = interiorLight;

  const archSpot = new THREE.SpotLight(FIL_BLUE, 4, 25, Math.PI / 6);
  archSpot.position.set(0, 4, 3.5);
  archSpot.target.position.set(0, 0, 10);
  archSpot.castShadow = true;
  storageGroup.add(archSpot);
  storageGroup.add(archSpot.target);

  // 9. Storage fill-meter (mounted on right inner wall)
  const METER_MAX_TFIL = 0.05;
  const meterPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.3, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.9, flatShading: true })
  );
  meterPedestal.position.set(4.5, 0.35, 0);
  meterPedestal.castShadow = true;
  storageGroup.add(meterPedestal);
  const meterFill = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.12, 0.35),
    new THREE.MeshStandardMaterial({
      color: FIL_BLUE,
      emissive: FIL_BLUE,
      emissiveIntensity: 0.8,
      roughness: 0.4,
      metalness: 0.3,
    })
  );
  meterFill.position.set(4.5, 0.5, 0);
  meterFill.scale.y = 0.5;
  storageGroup.add(meterFill);
  (storageGroup as { userData: { meterFill?: { scale: { y: number }; position: { y: number } } } }).userData.meterFill = meterFill;

  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 128;
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: signTex, transparent: true, depthTest: false })
  );
  signSprite.position.set(0, POST_H - 0.3, 2.7);
  signSprite.scale.set(3.5, 0.9, 1);
  storageGroup.add(signSprite);
  storageGroup.position.set(STORAGE_POS.x, ty, STORAGE_POS.z);
  scene.add(storageGroup);

  // ── Storage carriers (small robots walking depot ↔ campfire: data retrieval) ──
  const depotStartPos = new THREE.Vector3(STORAGE_POS.x, ty + 0.5, STORAGE_POS.z);
  type StorageCarrier = {
    mesh: { position: { x: number; y: number; z: number; lerpVectors: (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number) => void }; rotation: { y: number } };
    mixer: { update: (dt: number) => void };
    phase: number;
    direction: 1 | -1;
    startPos: { x: number; y: number; z: number };
    endPos: { x: number; y: number; z: number };
  };
  const storageCarriers: StorageCarrier[] = [];
  const walkClipForCarrier = gltf.animations?.find((a: { name: string }) => a.name === "Walking") ?? null;
  CAMPFIRE_CONFIG.forEach((cfg) => {
    const endPos = new THREE.Vector3(cfg.x, H(cfg.x, cfg.z) + 0.5, cfg.z);
    const clone = gltf.scene.clone(true);
    clone.scale.setScalar(0.35);
    clone.traverse((obj: { isMesh?: boolean; material?: { color?: { setHex: (h: number) => void } }; castShadow?: boolean }) => {
      if (obj.isMesh && obj.material) {
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        if (mat?.color) mat.color.setHex(0x888888);
        if (obj.castShadow !== undefined) obj.castShadow = true;
      }
    });
    const mixer = new THREE.AnimationMixer(clone);
    if (walkClipForCarrier) {
      const action = mixer.clipAction(walkClipForCarrier);
      action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
    const g = new THREE.Group();
    g.add(clone);
    g.position.copy(depotStartPos);
    scene.add(g);
    storageCarriers.push({
      mesh: g,
      mixer,
      phase: (storageCarriers.length / CAMPFIRE_CONFIG.length),
      direction: 1,
      startPos: depotStartPos.clone(),
      endPos,
    });
  });
  (scene as { userData: { storageCarriers?: StorageCarrier[] } }).userData.storageCarriers = storageCarriers;

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
    const ud = (storageGroup as { userData: { artifactTablets: { mesh: { visible: boolean } }[]; minTablets: number; meterFill?: { scale: { y: number }; position: { y: number } } } }).userData;
    const minTablets = ud.minTablets ?? 6;
    const visibleCount = Math.min(MAX_ARTIFACT_TABLETS, Math.max(minTablets, totalRuns));
    if (ud.artifactTablets) {
      ud.artifactTablets.forEach((entry, i) => {
        (entry.mesh as { visible: boolean }).visible = i < visibleCount;
      });
    }
    // Fill-meter: scale.y 1..20 (height 0.2..4.0) based on tFIL
    const tFilNum = Number(BigInt(summary.totalStorageCostWei)) / 1e18;
    const meterScale = Math.min(20, Math.max(1, 1 + (tFilNum / METER_MAX_TFIL) * 19));
    if (ud.meterFill) {
      ud.meterFill.scale.y = meterScale;
      ud.meterFill.position.y = 0.6 + (0.2 * meterScale) / 2; // bottom on pedestal top
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
    mixer: { clipAction: (clip: unknown) => { reset: () => { setLoop: (mode: number, reps: number) => { fadeIn: (d: number) => { play: () => void }; play: () => void }; fadeOut: (d: number) => void }; setEffectiveWeight: (w: number) => unknown; setEffectiveTimeScale: (s: number) => unknown }; update: (dt: number) => void } | null;
    walkClip: { name: string } | null;
    idleClip: { name: string } | null;
    sittingClip: { name: string } | null;
    activeMixerAction: { fadeOut: (d: number) => void; reset: () => { setEffectiveTimeScale: (s: number) => unknown; setEffectiveWeight: (w: number) => unknown; fadeIn: (d: number) => { play: () => void }; play: () => void }; play: () => void } | null;
  }

  const agentCreatures: AgentCreature[] = [];
  const FIRE_RING_RADIUS = 3.5; // agents circle around their network's fire
  const agentsByNetwork = new Map<string, AgentRow[]>();
  initialData.agentRows.forEach((row) => {
    const list = agentsByNetwork.get(row.networkId) ?? [];
    list.push(row);
    agentsByNetwork.set(row.networkId, list);
  });
  const idleClip = gltf.animations?.find((a: { name: string }) => a.name === "Idle") ?? null;
  const walkClip = gltf.animations?.find((a: { name: string }) => a.name === "Walking") ?? null;
  const sittingClip = gltf.animations?.find((a: { name: string }) => a.name === "Sitting") ?? null;

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

    const isActive = row.economy.status === "healthy";
    const colors: { primary: number; glow: number } = (isActive ? AGENT_COLORS_ACTIVE : AGENT_COLORS_INACTIVE)[cfg.type as keyof typeof AGENT_COLORS_ACTIVE] ?? AGENT_COLORS_ACTIVE.Worker;
    const clipToPlay = isActive ? idleClip : sittingClip;

    const clone = gltf.scene.clone(true);
    clone.scale.setScalar(0.55);
    clone.traverse((obj: { isMesh?: boolean; material?: { color?: { setHex: (h: number) => void }; metalness?: number; roughness?: number; emissive?: { setHex: (h: number) => void }; emissiveIntensity?: number }; name?: string }) => {
      if (obj.isMesh && obj.material) {
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        if (mat && mat.color) {
          mat.color.setHex(colors.primary);
          mat.metalness = 0.6;
          mat.roughness = 0.4;
          const isEye = /eye|visor|glass|head_4/i.test(obj.name ?? "");
          if (mat.emissive) {
            mat.emissive.setHex(isEye ? colors.glow : 0x000000);
            mat.emissiveIntensity = isEye ? 1.5 : isActive ? 0.35 : 0;
          }
        }
      }
    });
    clone.traverse((obj: { castShadow?: boolean; receiveShadow?: boolean }) => {
      if (obj.castShadow !== undefined) obj.castShadow = true;
      if (obj.receiveShadow !== undefined) obj.receiveShadow = true;
    });

    const mixer = new THREE.AnimationMixer(clone);
    let activeMixerAction: { fadeOut: (d: number) => void; reset: () => { setEffectiveTimeScale: (s: number) => unknown; setEffectiveWeight: (w: number) => unknown; fadeIn: (d: number) => { play: () => void }; play: () => void }; play: () => void } | null = null;
    if (clipToPlay) {
      activeMixerAction = mixer.clipAction(clipToPlay);
      (activeMixerAction as any).reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }

    const g = new THREE.Group();
    g.add(clone);
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
    ls.position.y = 2.2; // above robot head (model scaled 0.55)
    ls.scale.set(3, 0.75, 1);
    g.add(ls);
    // Healthy agent glow — emerald ring at feet
    const healthGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.95, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    healthGlow.position.y = 0.02;
    healthGlow.visible = row.economy.status === "healthy";
    g.add(healthGlow);
    g.position.set(x, y, z);
    g.userData = { creature: { id: row.agentId, row, cfg }, healthGlow };
    scene.add(g);
    agentCreatures.push({
      id: row.agentId,
      mesh: g,
      x,
      z,
      y,
      facing: 0,
      size,
      row,
      cfg,
      mixer,
      walkClip,
      idleClip,
      sittingClip,
      activeMixerAction,
    });
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
    const storageHits = ray.intersectObject(storageGroup, true);
    if (storageHits.length > 0) {
      onStorageDepotClick();
      return;
    }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- THREE.js from CDN
  function fadeToAction(mixer: any, prevAction: any, targetClip: any, duration: number): any {
    if (!mixer || !targetClip) return prevAction;
    const newAction = mixer.clipAction(targetClip);
    if (prevAction && prevAction !== newAction) prevAction.fadeOut(duration);
    newAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
    return newAction;
  }

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
      c.mesh.position.y = c.y;
      c.mesh.position.z = c.z;
      c.mesh.rotation.y = c.facing;
      if (c.mixer) c.mixer.update(dt);
      const ud = (c.mesh as { userData?: { healthGlow?: { visible: boolean } } }).userData;
      const currentRow = dataRef.current.agentRows.find((r) => r.agentId === c.id);
      if (ud?.healthGlow && currentRow) {
        ud.healthGlow.visible = currentRow.economy.status === "healthy";
      }
      // Crossfade Idle <-> Sitting on status change
      if (currentRow) {
        const wasActive = c.row.economy.status === "healthy";
        const nowActive = currentRow.economy.status === "healthy";
        if (wasActive !== nowActive) {
          const target = nowActive ? c.idleClip : c.sittingClip;
          if (target) {
            c.activeMixerAction = fadeToAction(c.mixer, c.activeMixerAction, target, 0.4);
          }
          c.row = currentRow;
        }
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
    // Storage carriers: small robots walk depot <-> campfire
    const carriersUd = scene.userData as { storageCarriers?: { mesh: { position: { lerpVectors: (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number) => void }; rotation: { y: number } }; mixer: { update: (dt: number) => void }; phase: number; direction: 1 | -1; startPos: { x: number; y: number; z: number }; endPos: { x: number; y: number; z: number } }[] };
    if (carriersUd.storageCarriers) {
      carriersUd.storageCarriers.forEach((carrier) => {
        carrier.phase += dt * 0.25;
        if (carrier.phase >= 1) {
          carrier.phase = 0;
          carrier.direction = (carrier.direction === 1 ? -1 : 1) as 1 | -1;
        }
        const t = carrier.direction === 1 ? carrier.phase : 1 - carrier.phase;
        carrier.mesh.position.lerpVectors(carrier.startPos, carrier.endPos, t);
        const dx = carrier.endPos.x - carrier.startPos.x;
        const dz = carrier.endPos.z - carrier.startPos.z;
        carrier.mesh.rotation.y = carrier.direction === 1 ? Math.atan2(dx, dz) : Math.atan2(-dx, -dz);
        carrier.mixer.update(dt);
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
    const sgUd = (storageGroup as { userData: { beaconLight?: { intensity: number } } }).userData;
    if (sgUd.beaconLight) sgUd.beaconLight.intensity = 1.2 + Math.sin(now * 0.008) * 0.6;
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
