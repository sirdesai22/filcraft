"use client";

/**
 * AetheriaWorld — FilCraft Living World interface for the Agent Economy.
 * Three.js game world with real economy data bindings.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IDENTITY_REGISTRY_ABI } from "@/lib/identity-registry-abi";
import { NETWORKS, type NetworkId } from "@/lib/networks";
import type {
  AgentEconomyAccount,
  EconomyEvent,
  EconomySummary,
} from "@/lib/economy";

// ── Virtual Joystick (mobile) ─────────────────────────────────────────────────

function VirtualJoystick({
  axis,
  onValue,
  side,
}: {
  axis: "pan" | "rotate";
  onValue: (axis: "pan" | "rotate", x: number, y: number) => void;
  side: "left" | "right";
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);

  const updateFromClient = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const R = Math.min(rect.width, rect.height) / 2 * 0.7;
    const dist = Math.min(1, Math.hypot(dx, dy) / Math.max(1, R));
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * dist;
    const ny = Math.sin(angle) * dist;
    setThumb({ x: nx * 0.6, y: ny * 0.6 });
    if (axis === "pan") {
      onValue("pan", nx, ny);
    } else {
      onValue("rotate", nx, 0);
    }
  }, [axis, onValue]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    baseRef.current?.setPointerCapture(e.pointerId);
    activeRef.current = true;
    updateFromClient(e.clientX, e.clientY);
  }, [updateFromClient]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeRef.current) return;
    updateFromClient(e.clientX, e.clientY);
  }, [updateFromClient]);

  const handlePointerUp = useCallback(() => {
    activeRef.current = false;
    setThumb({ x: 0, y: 0 });
    if (axis === "pan") {
      onValue("pan", 0, 0);
    } else {
      onValue("rotate", 0, 0);
    }
  }, [axis, onValue]);

  const releaseRef = useRef(handlePointerUp);
  releaseRef.current = handlePointerUp;
  useEffect(() => {
    const up = () => { if (activeRef.current) releaseRef.current(); };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div
      ref={baseRef}
      role="slider"
      aria-label={axis === "pan" ? "Pan joystick" : "Rotate joystick"}
      tabIndex={-1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="touch-manipulation select-none pointer-events-auto w-[clamp(72px,22vw,100px)] h-[clamp(72px,22vw,100px)]"
      style={{
        position: "absolute",
        ...(side === "left"
          ? { left: "max(12px, env(safe-area-inset-left))" }
          : { right: "max(12px, env(safe-area-inset-right))" }),
        bottom: "max(16px, calc(env(safe-area-inset-bottom) + 8px))",
        touchAction: "none",
      }}
    >
      {/* Base circle */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "rgba(6,4,1,0.85)",
          border: "1px solid rgba(90,74,42,0.5)",
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.4)",
        }}
      />
      {/* Thumb — positioned via transform for responsive scaling */}
      <div
        className="absolute left-1/2 top-1/2 w-[44%] h-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          marginLeft: `calc(${thumb.x} * 28%)`,
          marginTop: `calc(${thumb.y} * 28%)`,
          background: "radial-gradient(circle at 35% 35%, rgba(245,217,106,0.4), rgba(180,140,40,0.25))",
          border: "1px solid rgba(245,217,106,0.4)",
          boxShadow: "0 0 12px rgba(245,217,106,0.2)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

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

// Campfire positions and network labels — agents spawn at their chain's fire (scaled for smaller boxed world)
const CAMPFIRE_CONFIG = [
  { x: 0, z: 0, label: "Filecoin Calibration", chainId: "314159", networkId: "filecoinCalibration" },
  { x: -6, z: 5, label: "Ethereum Sepolia", chainId: "11155111", networkId: "sepolia" },
  { x: 6, z: -3, label: "Base Sepolia", chainId: "84532", networkId: "baseSepolia" },
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

  // Default scoreboard collapsed on mobile for more canvas space
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches) {
      setScoreboardExpanded(false);
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [agentExtra, setAgentExtra] = useState<{
    creditScore?: number;
    tier?: string;
    artifactCount?: number;
  } | null>(null);
  const [agentTab, setAgentTab] = useState<"overview" | "economy" | "artifacts" | "activity">("overview");
  const [agentActivity, setAgentActivity] = useState<{ runId: string; status: string; createdAt: string; reportUrl: string; summary: string; focCid?: string }[]>([]);
  const [agentArtifacts, setAgentArtifacts] = useState<{ id: string; category: string; priceUsdc: string; license: string; contentCid: string; active: boolean; createdAt: string }[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [regNetwork, setRegNetwork] = useState<NetworkId>("filecoinCalibration");
  const [regStep, setRegStep] = useState(1);
  const [regCardUrl, setRegCardUrl] = useState("");
  const [regHealthUrl, setRegHealthUrl] = useState("");
  const [regValidating, setRegValidating] = useState(false);
  const [regValidation, setRegValidation] = useState<{ valid: boolean; agentCard: any; health: boolean; errors: string[] } | null>(null);
  const [regTxHash, setRegTxHash] = useState<`0x${string}` | undefined>();
  const [showControlsModal, setShowControlsModal] = useState(false);
  const setMobileKey = useCallback((key: string, value: boolean) => {
    const mk = (containerRef.current as unknown as { __aetheriaMobileKeys?: Record<string, boolean> })?.__aetheriaMobileKeys;
    if (mk) mk[key] = value;
  }, []);
  const setJoystick = useCallback((axis: "pan" | "rotate", x: number, y: number) => {
    const j = (containerRef.current as unknown as { __aetheriaMobileJoystick?: { panX: number; panY: number; rotate: number } })?.__aetheriaMobileJoystick;
    if (!j) return;
    if (axis === "pan") {
      j.panX = x;
      j.panY = y;
    } else {
      j.rotate = x;
    }
  }, []);
  const { writeContract: regWriteContract, isPending: regIsWriting, error: regWriteError } = useWriteContract();
  const { isLoading: regIsConfirming, isSuccess: regIsConfirmed } = useWaitForTransactionReceipt({ hash: regTxHash });

  const regNetworkConfig = NETWORKS[regNetwork];

  async function handleRegVerify() {
    if (!regCardUrl.trim()) return;
    setRegValidating(true);
    setRegValidation(null);
    try {
      const res = await fetch("/api/agents/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentCardUrl: regCardUrl.trim(), healthUrl: regHealthUrl.trim() || undefined }),
      });
      const d = await res.json();
      setRegValidation({ valid: d.valid ?? false, agentCard: d.agentCard ?? null, health: d.health ?? false, errors: d.errors ?? [] });
    } catch {
      setRegValidation({ valid: false, agentCard: null, health: false, errors: ["Network error"] });
    } finally {
      setRegValidating(false);
    }
  }

  function handleRegSubmit() {
    if (!regCardUrl.trim()) return;
    regWriteContract(
      {
        address: regNetworkConfig.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "register",
        args: [regCardUrl.trim()],
        chainId: regNetworkConfig.chain.id,
      },
      { onSuccess(hash) { setRegTxHash(hash); } }
    );
  }

  function closeRegister() {
    setShowRegister(false);
    setRegStep(1);
    setRegCardUrl("");
    setRegHealthUrl("");
    setRegValidation(null);
    setRegTxHash(undefined);
  }

  useEffect(() => {
    if (!selectedAgentId) {
      setAgentExtra(null);
      setAgentActivity([]);
      setAgentArtifacts([]);
      setAgentTab("overview");
      return;
    }
    let cancelled = false;
    setTabLoading(true);
    Promise.all([
      fetch(`/api/agents/${selectedAgentId}/score?network=${DEFAULT_NETWORK}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/data-listings?agentId=${selectedAgentId}`).then((r) => (r.ok ? r.json() : { listings: [], total: 0 })),
      fetch(`/api/agents/${selectedAgentId}/activity`).then((r) => (r.ok ? r.json() : { reports: [] })),
    ]).then(([scoreRes, listingsRes, activityRes]) => {
      if (cancelled) return;
      setAgentExtra({
        creditScore: scoreRes?.score,
        tier: scoreRes?.label,
        artifactCount: listingsRes?.total ?? 0,
      });
      setAgentArtifacts(listingsRes?.listings ?? []);
      setAgentActivity(activityRes?.reports ?? []);
      setTabLoading(false);
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

  // Lock body scroll while world is mounted
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

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

    const loadDRACOLoader = (): Promise<unknown> => {
      return new Promise((resolve) => {
        if (typeof window !== "undefined" && (window as unknown as { THREE?: { DRACOLoader?: unknown } }).THREE?.DRACOLoader) {
          resolve(undefined);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js";
        script.async = true;
        script.onload = () => resolve(undefined);
        document.head.appendChild(script);
      });
    };

    type GLTFLoaderCtor = new () => { load: (url: string, onLoad: (gltf: unknown) => void, onProgress?: unknown, onError?: (err: unknown) => void) => void; setDRACOLoader?: (loader: unknown) => void };
    type DRACOLoaderCtor = new () => { setDecoderPath: (path: string) => unknown };

    const loadModel = (path: string, name: string): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const THREE = (window as unknown as { THREE: { GLTFLoader: GLTFLoaderCtor; DRACOLoader?: DRACOLoaderCtor } }).THREE;
        const GLTFLoader = THREE?.GLTFLoader;
        if (!GLTFLoader) {
          reject(new Error(`GLTFLoader not available on window.THREE when loading ${name}`));
          return;
        }
        const loader = new GLTFLoader();
        // Draco-compressed GLB models require DRACOLoader to decode
        if (loader.setDRACOLoader && THREE.DRACOLoader) {
          const dracoLoader = new THREE.DRACOLoader();
          dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
          loader.setDRACOLoader(dracoLoader);
        }
        loader.load(
          path,
          (gltf) => resolve(gltf),
          undefined,
          (err) => {
            console.error(`[AetheriaWorld] Failed to load ${name} (${path}):`, err);
            reject(err);
          }
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
        return loadDRACOLoader().then(() => ({ THREE }));
      })
      .then(({ THREE }) => {
        if (cancelled) return Promise.reject(new Error("cancelled"));
        return Promise.all([
          loadModel("/models/RobotExpressive.glb", "RobotExpressive"),
          loadModel("/models/Castle.glb", "CastleModel"),
          loadModel("/models/filecoin_model.glb", "filecoin_model"),
          loadModel("/models/furnace.glb", "furnace"),
        ]).then(([gltf, castleGltf, filecoinGltf, furnaceGltf]) => ({ THREE, gltf, castleGltf, filecoinGltf, furnaceGltf }));
      })
      .then(({ THREE, gltf, castleGltf, filecoinGltf, furnaceGltf }) => {
        if (cancelled) return;
        initWorld(THREE, containerRef.current!, dataRef, setSelectedAgentId, gltf as { scene: any; animations: any[] }, castleGltf as { scene: any }, filecoinGltf as { scene: any }, furnaceGltf as { scene: any }, () => {}, () => setShowRegister(true));
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
    ? ({
        ...(AGENT_CONFIG[selectedRow.agentId] ?? { emoji: "🤖", type: "Agent", spawnNear: [0, 0] as [number, number] }),
        displayName: selectedRow.name, // always use real registry name

      })
    : null;

  return (
    <div className="relative w-full overflow-hidden bg-[#0a0a0f]" style={{ height: "calc(100vh - 56px)" }}>
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
            FILCRAFT
          </h1>
          <p className="text-[#5a4a2a] tracking-[4px] mt-2 text-xs">
            ENTERING ...
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
        <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 text-center px-2">
          <h1
            className="font-black text-lg sm:text-[26px] text-[#f5d96a] tracking-[4px] sm:tracking-[6px] uppercase"
            style={{
              fontFamily: "Cinzel, serif",
              textShadow: "0 0 20px rgba(245,217,106,0.5), 0 2px 4px rgba(0,0,0,0.8)",
            }}
          >
            FilCraft
          </h1>
          <div className="text-[10px] text-[#a89060] tracking-[4px] mt-0.5">
            The Living World
          </div>
        </div>


        

        {/* Scoreboard panel */}
        <div
          id="scoreboard-panel"
          className="absolute top-2 sm:top-3 right-2 sm:right-3 pointer-events-auto flex flex-col transition-all duration-200 max-w-[calc(100vw-1rem)]"
          style={{
            width: scoreboardExpanded ? "min(300px, calc(100vw - 16px))" : 160,
            background: "linear-gradient(160deg, rgba(6,4,1,0.98) 0%, rgba(16,10,2,0.97) 100%)",
            border: "1px solid rgba(180,140,40,0.25)",
            borderRadius: 3,
            boxShadow: "0 0 0 1px rgba(180,140,40,0.06), 0 12px 50px rgba(0,0,0,0.9), inset 0 1px 0 rgba(245,217,106,0.08)",
            maxHeight: scoreboardExpanded ? "calc(100vh - 80px)" : "none",
            fontSize: 17,
          }}
        >
          {/* Header — clickable to collapse/expand */}
          <button
            type="button"
            onClick={() => setScoreboardExpanded((v) => !v)}
            className="w-full text-left cursor-pointer hover:bg-[rgba(245,217,106,0.04)] transition-colors flex items-center justify-between gap-2"
            style={{ position: "relative", padding: scoreboardExpanded ? "12px 16px 10px" : "10px 14px", borderBottom: scoreboardExpanded ? "1px solid rgba(90,74,42,0.3)" : "none", background: "linear-gradient(90deg, transparent, rgba(180,140,40,0.07), transparent)" }}
            title={scoreboardExpanded ? "Collapse scoreboard" : "Expand scoreboard"}
          >
            {/* Corner ornaments — only when expanded */}
            {scoreboardExpanded && [["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h]) => (
              <div key={v+h} style={{ position: "absolute", [v]: 5, [h]: 8, width: 7, height: 7,
                borderTop: v === "top" ? "1px solid rgba(245,217,106,0.5)" : undefined,
                borderBottom: v === "bottom" ? "1px solid rgba(245,217,106,0.5)" : undefined,
                borderLeft: h === "left" ? "1px solid rgba(245,217,106,0.5)" : undefined,
                borderRight: h === "right" ? "1px solid rgba(245,217,106,0.5)" : undefined,
              }} />
            ))}
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontFamily: "Cinzel, serif", fontSize: scoreboardExpanded ? 14 : 11, fontWeight: 700, letterSpacing: scoreboardExpanded ? "0.22em" : "0.1em", textAlign: scoreboardExpanded ? "center" : "left", color: "#f5d96a", textShadow: "0 0 18px rgba(245,217,106,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {scoreboardExpanded ? "⚔ AGENT ECONOMY ⚔" : "⚔ SCOREBOARD"}
              </div>
              {scoreboardExpanded && (
                <div style={{ fontFamily: "Cinzel, serif", fontSize: 10, letterSpacing: "0.35em", textAlign: "center", color: "rgba(245,217,106,0.85)", marginTop: 2 }}>
                  SCOREBOARD
                </div>
              )}
            </div>
            <span style={{ flexShrink: 0, color: "#a89060", fontSize: 12, transition: "transform 0.2s", transform: scoreboardExpanded ? "rotate(180deg)" : "rotate(0deg)" }} aria-hidden>
              ▼
            </span>
          </button>

          {/* Agent rows */}
          {scoreboardExpanded && (
          <div style={{ padding: "4px 0", overflowY: "auto", flex: 1, minHeight: 0, scrollbarWidth: "none" }}
            className="[&::-webkit-scrollbar]:hidden"
          >
            {data.agentRows
              .sort((a, b) => Number(BigInt(b.economy.totalSpent) - BigInt(a.economy.totalSpent)))
              .map((row, idx) => {
                const cfg = AGENT_CONFIG[row.agentId];
                const isHealthy = row.economy.status === "healthy";
                const isAtRisk = row.economy.status === "at-risk";
                const statusColor = isHealthy ? "#10b981" : isAtRisk ? "#f59e0b" : "#4b5563";
                const statusGlow = isHealthy ? "0 0 7px rgba(16,185,129,0.9)" : isAtRisk ? "0 0 7px rgba(245,158,11,0.9)" : "none";
                const rankLabel = ["Ⅰ","Ⅱ","Ⅲ","Ⅳ","Ⅴ"][idx] ?? `${idx+1}`;
                const rankColor = idx === 0 ? "#f5d96a" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "#a89060";
                const rankBg = idx === 0 ? "rgba(245,217,106,0.12)" : idx === 1 ? "rgba(192,192,192,0.08)" : idx === 2 ? "rgba(205,127,50,0.08)" : "rgba(40,30,10,0.4)";
                const rankBorder = idx === 0 ? "rgba(245,217,106,0.35)" : idx === 1 ? "rgba(192,192,192,0.25)" : idx === 2 ? "rgba(205,127,50,0.25)" : "rgba(60,45,15,0.4)";

                return (
                  <button
                    key={row.agentId}
                    type="button"
                    onClick={() => setSelectedAgentId(row.agentId)}
                    title="View agent details"
                    className="w-full text-left cursor-pointer hover:bg-[rgba(245,217,106,0.04)] transition-colors"
                    style={{
                      padding: "9px 14px",
                      borderBottom: idx < data.agentRows.length - 1 ? "1px solid rgba(60,45,15,0.4)" : undefined,
                      background: idx === 0 ? "linear-gradient(90deg, rgba(245,217,106,0.03), transparent 70%)" : "transparent",
                    }}
                  >
                    {/* Top row: rank + status dot + name + view link */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: rankBg, border: `1px solid ${rankBorder}`, fontFamily: "Cinzel, serif", fontSize: 13, fontWeight: 700, color: rankColor, textShadow: idx === 0 ? "0 0 8px rgba(245,217,106,0.6)" : "none" }}>
                        {rankLabel}
                      </div>
                      <div className={isHealthy ? "animate-pulse" : isAtRisk ? "animate-pulse" : ""} style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: statusColor, boxShadow: statusGlow, animationDuration: isAtRisk ? "0.9s" : "2s" }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: "#e0cc98", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cfg?.emoji ?? "🤖"} {row.name}
                      </div>
                      <span style={{ fontSize: 10, color: "#a89060", letterSpacing: "0.08em", flexShrink: 0 }}>View →</span>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginTop: 7, marginLeft: 30, background: "rgba(0,0,0,0.3)", borderRadius: 2, border: "1px solid rgba(60,45,15,0.5)", overflow: "hidden" }}>
                      {[
                        { label: "RUNS", value: String(row.completedRuns), color: "#f0dc90" },
                        { label: "EARNED", value: `$${formatUsd(row.economy.totalEarned)}`, color: "#34d399" },
                        { label: "SPENT", value: `${formatTFil(row.economy.totalSpent)}`, color: "#f5b040" },
                      ].map((stat, si) => (
                        <div key={stat.label} style={{ flex: 1, padding: "4px 6px", borderLeft: si > 0 ? "1px solid rgba(60,45,15,0.5)" : undefined, textAlign: "center" }}>
                          <div style={{ fontFamily: "Cinzel, serif", fontSize: 10, color: "#b8a060", letterSpacing: "0.1em", marginBottom: 2 }}>{stat.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: stat.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
          </div>
          )}

          {/* Footer */}
          {scoreboardExpanded && (
          <div style={{ borderTop: "1px solid rgba(90,74,42,0.3)", padding: "10px 14px", background: "linear-gradient(90deg, transparent, rgba(180,140,40,0.04), transparent)" }}>
            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: 10, color: "#a89060", letterSpacing: "0.12em", marginBottom: 2 }}>TOTAL STORAGE</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#e8a030", lineHeight: 1 }}>
                  {formatTFil(data.summary.totalStorageCostWei)} <span style={{ fontSize: 12, color: "#c0a850" }}>tFIL</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: 10, color: "#a89060", letterSpacing: "0.12em", marginBottom: 2 }}>TOTAL REVENUE</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#10b981", lineHeight: 1 }}>
                  ${formatUsd(data.summary.totalRevenueUsdCents)}
                </div>
              </div>
            </div>

            {/* Status badges */}
            <div style={{ display: "flex", gap: 5 }}>
              {[
                { count: data.summary.activeAgents, label: "ACTIVE", color: "#10b981", glow: "rgba(16,185,129,0.7)", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)" },
                { count: data.summary.atRiskAgents, label: "AT RISK", color: "#f59e0b", glow: "rgba(245,158,11,0.7)", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
                { count: data.summary.windDownCount, label: "WOUND", color: "#6b7280", glow: "none", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
              ].map((s) => (
                <div key={s.label} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "4px 0", borderRadius: 2, background: s.bg, border: `1px solid ${s.border}` }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, boxShadow: s.glow !== "none" ? `0 0 5px ${s.glow}` : undefined }} />
                  <span style={{ fontFamily: "Cinzel, serif", fontSize: 11, color: s.color, letterSpacing: "0.05em" }}>{s.count} {s.label}</span>
                </div>
              ))}
            </div>

            {lastRefresh && (
              <div style={{ marginTop: 7, fontSize: 8, color: "#8a7a4a", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
                <div className="animate-pulse" style={{ width: 4, height: 4, borderRadius: "50%", background: "#a89060" }} />
                LIVE · {Math.round((Date.now() - lastRefresh.getTime()) / 1000)}s ago
              </div>
            )}
          </div>
          )}
        </div>

        {/* Activity log — hidden on mobile to avoid clutter */}
        <div
          id="activity-log"
          className="hidden sm:block absolute bottom-16 left-12 w-[280px] max-h-[180px] overflow-y-auto pointer-events-auto scrollbar-thin"
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

        {/* Agent detail dialog — tab-based in-game style */}
        {selectedRow && selectedCfg && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/50 pointer-events-auto"
              onClick={() => setSelectedAgentId(null)}
              aria-hidden="true"
            />
            <div
              id="agent-dialog"
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[min(520px,92vw)] max-h-[85vh] pointer-events-auto flex flex-col"
              style={{ fontFamily: "MedievalSharp, cursive" }}
              role="dialog"
              aria-labelledby="agent-dialog-title"
            >
              <div
                className="rounded-lg overflow-hidden border-2 border-[#5a4a2a] flex flex-col max-h-[85vh]"
                style={{
                  background: "linear-gradient(180deg, #2a2318 0%, #1c180f 50%, #151210 100%)",
                  boxShadow: "0 0 0 1px #7a6a3a, 0 0 40px rgba(0,0,0,0.8), inset 0 0 60px rgba(90,74,42,0.08)",
                }}
              >
                {/* Header with agent identity + close */}
                <div className="px-4 py-3 border-b border-[#5a4a2a]/60 shrink-0" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <div className="flex items-center justify-between mb-2">
              
                    <button
                      type="button"
                      onClick={() => setSelectedAgentId(null)}
                      className="w-8 h-8 rounded border border-[#5a4a2a] flex items-center justify-center text-[#a89060] hover:text-[#f5d96a] hover:border-[#f5d96a] transition-colors"
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Agent identity — always visible */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg border-2 border-[#7a6a3a] flex items-center justify-center text-[28px] shrink-0"
                      style={{ background: `#${(selectedCfg.type === "Worker" ? 0x8a6a3a : selectedCfg.type === "Shaman" ? 0x6a3a8a : selectedCfg.type === "Warrior" ? 0x4a7a3a : 0x5a5a5a).toString(16).padStart(6, "0")}44` }}
                    >
                      {selectedCfg.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[#f5d96a] font-bold text-base" style={{ fontFamily: "Cinzel, serif" }}>
                        {selectedCfg.displayName}
                      </div>
                      <div className="text-[#a89060] text-xs">
                        {selectedCfg.type} · #{selectedRow.agentId}
                        <span className="ml-2">
                          <span className={selectedRow.economy.status === "healthy" ? "text-emerald-500" : selectedRow.economy.status === "at-risk" ? "text-amber-500" : "text-zinc-400"}>
                            {selectedRow.economy.status === "healthy" ? "● Healthy" : selectedRow.economy.status === "at-risk" ? "● At Risk" : "● Wound Down"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-[#5a4a2a]/60 shrink-0" style={{ background: "rgba(0,0,0,0.2)" }}>
                  {(["overview", "economy", "artifacts", "activity"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setAgentTab(tab)}
                      className="flex-1 py-2.5 text-center text-xs uppercase tracking-widest transition-all"
                      style={{
                        fontFamily: "Cinzel, serif",
                        color: agentTab === tab ? "#f5d96a" : "#7a6a4a",
                        borderBottom: agentTab === tab ? "2px solid #f5d96a" : "2px solid transparent",
                        background: agentTab === tab ? "rgba(245,217,106,0.06)" : "transparent",
                        textShadow: agentTab === tab ? "0 0 10px rgba(245,217,106,0.4)" : "none",
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab content — scrollable */}
                <div className="overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "#5a4a2a #151210" }}>
                  <div className="p-4 space-y-4">

                    {/* ── OVERVIEW TAB ── */}
                    {agentTab === "overview" && (
                      <>
                        {agentExtra?.tier && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#a89060]">Credit Score:</span>
                            <span className="text-[#f5d96a] font-semibold">{agentExtra.tier}</span>
                            {agentExtra.creditScore != null && (
                              <span className="text-[#7a8a6a]">({agentExtra.creditScore})</span>
                            )}
                          </div>
                        )}

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

                        {selectedRow.economy.lastActivity > 0 && (
                          <div className="text-[11px] text-[#a89060]">
                            Last activity: {new Date(selectedRow.economy.lastActivity * 1000).toLocaleString()}
                          </div>
                        )}

                        {agentExtra?.artifactCount != null && (
                          <div className="text-[11px] text-[#a89060]">
                            {agentExtra.artifactCount} artifact{agentExtra.artifactCount !== 1 ? "s" : ""} on marketplace
                          </div>
                        )}
                      </>
                    )}

                    {/* ── ECONOMY TAB ── */}
                    {agentTab === "economy" && (
                      <>
                        {/* P&L breakdown */}
                        <div className="space-y-3">
                          <div className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>
                            Profit & Loss
                          </div>

                          {/* Balance bar */}
                          <div className="p-3 rounded border border-[#5a4a2a]/50" style={{ background: "rgba(0,0,0,0.25)" }}>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-[9px] text-[#a89060] uppercase tracking-wider">Current Balance</span>
                              <span className="text-[#f5d96a] font-bold text-lg">{formatTFil(selectedRow.economy.balance)} tFIL</span>
                            </div>
                            <div className="h-2 bg-black/50 rounded overflow-hidden">
                              <div
                                className="h-full rounded"
                                style={{
                                  width: `${Math.min(100, (Number(BigInt(selectedRow.economy.balance)) / 1e18 / 0.005) * 100)}%`,
                                  background: "linear-gradient(90deg, #2a5a9a, #4a8adf, #6aaaff)",
                                  boxShadow: "0 0 8px rgba(74,138,223,0.4)",
                                }}
                              />
                            </div>
                          </div>

                          {/* Revenue vs Cost comparison */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded border border-emerald-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
                              <div className="text-[9px] text-emerald-500/70 uppercase tracking-wider mb-1">Total Revenue</div>
                              <div className="text-emerald-400 font-bold text-lg">${formatUsd(selectedRow.economy.totalEarned)}</div>
                              <div className="text-[9px] text-[#a89060] mt-1">USD earned</div>
                            </div>
                            <div className="p-3 rounded border border-blue-500/20" style={{ background: "rgba(0,144,255,0.05)" }}>
                              <div className="text-[9px] text-blue-400/70 uppercase tracking-wider mb-1">Total Storage</div>
                              <div className="text-blue-400 font-bold text-lg">{formatTFil(selectedRow.economy.totalSpent)}</div>
                              <div className="text-[9px] text-[#a89060] mt-1">tFIL spent</div>
                            </div>
                          </div>

                          {/* Key metrics */}
                          <div className="rounded border border-[#5a4a2a]/50 overflow-hidden">
                            <div className="px-3 py-2 border-b border-[#5a4a2a]/40" style={{ background: "rgba(0,0,0,0.2)" }}>
                              <span className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>Key Metrics</span>
                            </div>
                            <div className="divide-y divide-[#5a4a2a]/30">
                              <div className="flex justify-between px-3 py-2">
                                <span className="text-xs text-[#a89060]">Completed Runs</span>
                                <span className="text-xs text-[#f5d96a] font-bold">{selectedRow.completedRuns}</span>
                              </div>
                              <div className="flex justify-between px-3 py-2">
                                <span className="text-xs text-[#a89060]">Cost per Run</span>
                                <span className="text-xs text-[#44aacc] font-bold">
                                  {selectedRow.completedRuns > 0
                                    ? (Number(BigInt(selectedRow.economy.totalSpent)) / 1e18 / selectedRow.completedRuns).toFixed(6)
                                    : "—"} tFIL
                                </span>
                              </div>
                              <div className="flex justify-between px-3 py-2">
                                <span className="text-xs text-[#a89060]">Revenue per Run</span>
                                <span className="text-xs text-[#e8a030] font-bold">
                                  {selectedRow.completedRuns > 0
                                    ? "$" + (Number(BigInt(selectedRow.economy.totalEarned)) / 100 / selectedRow.completedRuns).toFixed(2)
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between px-3 py-2">
                                <span className="text-xs text-[#a89060]">Status</span>
                                <span className={`text-xs font-bold ${selectedRow.economy.status === "healthy" ? "text-emerald-500" : selectedRow.economy.status === "at-risk" ? "text-amber-500" : "text-zinc-400"}`}>
                                  {selectedRow.economy.status === "healthy" ? "Healthy" : selectedRow.economy.status === "at-risk" ? "At Risk" : "Wound Down"}
                                </span>
                              </div>
                              {agentExtra?.tier && (
                                <div className="flex justify-between px-3 py-2">
                                  <span className="text-xs text-[#a89060]">Credit Tier</span>
                                  <span className="text-xs text-[#f5d96a] font-bold">{agentExtra.tier} {agentExtra.creditScore != null ? `(${agentExtra.creditScore})` : ""}</span>
                                </div>
                              )}
                              {selectedRow.economy.lastActivity > 0 && (
                                <div className="flex justify-between px-3 py-2">
                                  <span className="text-xs text-[#a89060]">Last Activity</span>
                                  <span className="text-xs text-[#c0b090]">{new Date(selectedRow.economy.lastActivity * 1000).toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Agent events for this agent */}
                          {(() => {
                            const agentEvents = data.events.filter((e) => e.agentId === selectedRow.agentId).slice(0, 8);
                            if (agentEvents.length === 0) return null;
                            return (
                              <div className="rounded border border-[#5a4a2a]/50 overflow-hidden">
                                <div className="px-3 py-2 border-b border-[#5a4a2a]/40" style={{ background: "rgba(0,0,0,0.2)" }}>
                                  <span className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>Recent Transactions</span>
                                </div>
                                <div className="divide-y divide-[#5a4a2a]/30">
                                  {agentEvents.map((ev, i) => (
                                    <div key={i} className="px-3 py-2 flex items-start gap-2">
                                      <span className={`text-[10px] mt-0.5 ${ev.type === "BudgetDeposited" ? "text-emerald-500" : ev.type === "StorageCostRecorded" ? "text-blue-500" : ev.type === "RevenueRecorded" ? "text-violet-400" : "text-zinc-400"}`}>
                                        {ev.type === "BudgetDeposited" ? "+" : ev.type === "StorageCostRecorded" ? "-" : ev.type === "RevenueRecorded" ? "$" : "x"}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[11px] text-[#c0b090]">{eventDescription(ev)}</div>
                                        <div className="text-[9px] text-[#7a6a4a] mt-0.5">Block #{ev.blockNumber}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </>
                    )}

                    {/* ── ARTIFACTS TAB ── */}
                    {agentTab === "artifacts" && (() => {
                      const ARTIFACT_IMAGES = [
                        "/artifacts/FantasyBook.png",
                        "/artifacts/MagicBook.png",
                        "/artifacts/MEDIEVALMAGICPOTION.png",
                      ];
                      return (
                        <>
                          <div className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>
                            Data Artifacts ({agentArtifacts.length})
                          </div>
                          {tabLoading ? (
                            <div className="text-center py-8 text-[#7a6a4a] text-sm">Loading artifacts...</div>
                          ) : agentArtifacts.length === 0 ? (
                            <div className="text-center py-8">
                              <div className="text-[#5a4a2a] text-3xl mb-2">-</div>
                              <div className="text-[#7a6a4a] text-sm">No artifacts listed on marketplace</div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {agentArtifacts.map((artifact, idx) => (
                                <div
                                  key={artifact.id}
                                  className="rounded border border-[#5a4a2a]/50 overflow-hidden flex"
                                  style={{ background: "rgba(0,0,0,0.25)" }}
                                >
                                  {/* Thumbnail */}
                                  <div className="w-16 h-16 shrink-0 overflow-hidden" style={{ background: "rgba(0,0,0,0.4)" }}>
                                    <img
                                      src={ARTIFACT_IMAGES[idx % ARTIFACT_IMAGES.length]}
                                      alt={`Artifact #${artifact.id}`}
                                      className="w-full h-full object-cover opacity-80"
                                      style={{ filter: "saturate(0.8) brightness(0.9)" }}
                                    />
                                  </div>
                                  {/* Details */}
                                  <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[#f5d96a] text-xs font-bold">#{artifact.id}</span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#5a4a2a]/40 text-[#a89060]">{artifact.category}</span>
                                      {artifact.active ? (
                                        <span className="text-[9px] text-emerald-500">Active</span>
                                      ) : (
                                        <span className="text-[9px] text-zinc-500">Inactive</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-[#7a6a4a] font-mono truncate">
                                      CID: {artifact.contentCid.slice(0, 20)}...
                                    </div>
                                    <div className="text-[9px] text-[#7a6a4a]">
                                      {artifact.license} · {new Date(Number(artifact.createdAt) * 1000).toLocaleDateString()}
                                    </div>
                                  </div>
                                  {/* Price */}
                                  <div className="shrink-0 px-3 flex items-center">
                                    <span className="text-[#e8a030] font-bold text-sm">${(Number(artifact.priceUsdc) / 1e6).toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* ── ACTIVITY TAB ── */}
                    {agentTab === "activity" && (
                      <>
                        <div className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>
                          Run History ({agentActivity.length})
                        </div>
                        {tabLoading ? (
                          <div className="text-center py-8 text-[#7a6a4a] text-sm">Loading activity...</div>
                        ) : agentActivity.length === 0 ? (
                          <div className="text-center py-8">
                            <div className="text-[#5a4a2a] text-3xl mb-2">-</div>
                            <div className="text-[#7a6a4a] text-sm">No activity reports found</div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {agentActivity.map((report, i) => (
                              <div
                                key={report.runId || i}
                                className="rounded border border-[#5a4a2a]/50 overflow-hidden"
                                style={{ background: "rgba(0,0,0,0.25)" }}
                              >
                                <div className="px-3 py-2.5">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${report.status === "completed" ? "bg-emerald-500" : report.status === "failed" ? "bg-red-500" : "bg-amber-500"}`} />
                                      <span className="text-[10px] text-[#a89060] uppercase tracking-wider">{report.status}</span>
                                    </div>
                                    <span className="text-[9px] text-[#7a6a4a]">
                                      {new Date(report.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {report.summary && (
                                    <p className="text-[11px] text-[#c0b090] mt-1 leading-relaxed">
                                      {report.summary}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2">
                                    {report.reportUrl && (
                                      <a
                                        href={report.reportUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-[#44aacc] hover:text-[#6accee] transition-colors"
                                      >
                                        View Report
                                      </a>
                                    )}
                                    {report.focCid && (
                                      <span className="text-[9px] text-[#7a6a4a] font-mono">
                                        FoC: {report.focCid.slice(0, 16)}...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Link to FilCraft — always visible */}
                    <Link
                      href={
                        selectedRow.networkId === "filecoinCalibration"
                          ? `/economy?agent=${selectedRow.agentId}&network=${selectedRow.networkId}`
                          : `/marketplace?agent=${selectedRow.agentId}&network=${selectedRow.networkId}`
                      }
                      className="block w-full py-2 text-center rounded border border-[#5a4a2a] text-[#f5d96a] text-sm font-medium hover:bg-[#5a4a2a]/30 hover:border-[#f5d96a]/50 transition-colors"
                    >
                      View on FilCraft
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Register Agent modal — matching world medieval gold style */}
        {showRegister && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/50 pointer-events-auto"
              onClick={closeRegister}
              aria-hidden="true"
            />
            <div
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[min(520px,92vw)] max-h-[85vh] pointer-events-auto flex flex-col"
              style={{ fontFamily: "MedievalSharp, cursive" }}
              role="dialog"
              aria-labelledby="register-dialog-title"
            >
              <div
                className="rounded-lg overflow-hidden border-2 border-[#5a4a2a] flex flex-col max-h-[85vh]"
                style={{
                  background: "linear-gradient(180deg, #2a2318 0%, #1c180f 50%, #151210 100%)",
                  boxShadow: "0 0 0 1px #7a6a3a, 0 0 40px rgba(0,0,0,0.8), inset 0 0 60px rgba(90,74,42,0.08)",
                }}
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-[#5a4a2a]/60 shrink-0" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <div className="flex items-center justify-between">
                    <h2 id="register-dialog-title" className="text-[#f5d96a] font-bold text-lg tracking-wider" style={{ fontFamily: "Cinzel, serif" }}>
                      FORGE NEW AGENT
                    </h2>
                    <button
                      type="button"
                      onClick={closeRegister}
                      className="w-8 h-8 rounded border border-[#5a4a2a] flex items-center justify-center text-[#a89060] hover:text-[#f5d96a] hover:border-[#f5d96a] transition-colors"
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-[#a89060] mt-1">Register your ERC-8004 agent on-chain</p>
                </div>

                {/* Step bar */}
                <div className="flex items-center justify-center gap-1 py-3 border-b border-[#5a4a2a]/30 shrink-0" style={{ background: "rgba(0,0,0,0.15)" }}>
                  {[{ n: 1, label: "Network" }, { n: 2, label: "Verify" }, { n: 3, label: "Register" }].map((s) => (
                    <button
                      key={s.n}
                      type="button"
                      onClick={() => setRegStep(s.n)}
                      className="flex items-center gap-1.5"
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                        style={{
                          background: regStep >= s.n ? "rgba(245,217,106,0.15)" : "rgba(90,74,42,0.2)",
                          color: regStep >= s.n ? "#f5d96a" : "#5a4a2a",
                          border: `1px solid ${regStep >= s.n ? "rgba(245,217,106,0.4)" : "rgba(90,74,42,0.3)"}`,
                          textShadow: regStep >= s.n ? "0 0 8px rgba(245,217,106,0.3)" : "none",
                        }}
                      >
                        {s.n}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider" style={{ fontFamily: "Cinzel, serif", color: regStep >= s.n ? "#f5d96a" : "#5a4a2a" }}>
                        {s.label}
                      </span>
                      {s.n < 3 && (
                        <span className="w-6 h-px mx-1" style={{ background: regStep > s.n ? "#f5d96a" : "#2a2018" }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Content — scrollable */}
                <div className="overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "#5a4a2a #151210" }}>
                  <div className="p-4 space-y-4">

                    {/* Success state */}
                    {regIsConfirmed && regTxHash ? (
                      <div className="text-center py-6 space-y-3">
                        <div className="text-[#f5d96a] text-4xl" style={{ textShadow: "0 0 20px rgba(245,217,106,0.5)" }}>&#10003;</div>
                        <div className="text-[#f5d96a] font-bold text-lg" style={{ fontFamily: "Cinzel, serif" }}>Agent Forged!</div>
                        <p className="text-[#a89060] text-sm">
                          Your agent will appear in the directory once indexed on {regNetworkConfig.name}.
                        </p>
                        <div className="flex justify-center gap-3 mt-4">
                          <a
                            href={`${regNetworkConfig.explorerTxUrl}${regTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded border border-[#5a4a2a] text-[#f5d96a] text-sm hover:bg-[#5a4a2a]/30 hover:border-[#f5d96a]/50 transition-colors"
                          >
                            View on {regNetworkConfig.explorerName}
                          </a>
                          <button
                            type="button"
                            onClick={closeRegister}
                            className="px-4 py-2 rounded border border-[#5a4a2a] text-[#a89060] text-sm hover:bg-[#5a4a2a]/30 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Step 1: Select Network */}
                        {regStep === 1 && (
                          <div className="space-y-3">
                            <div className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>
                              Choose Your Realm
                            </div>
                            {(Object.keys(NETWORKS) as NetworkId[]).map((id) => {
                              const n = NETWORKS[id];
                              const selected = regNetwork === id;
                              const isFilecoin = id === "filecoinCalibration";
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setRegNetwork(id)}
                                  className="w-full text-left rounded border p-3 transition-all"
                                  style={{
                                    borderColor: selected ? "rgba(245,217,106,0.4)" : "rgba(90,74,42,0.3)",
                                    background: selected ? "rgba(245,217,106,0.06)" : "rgba(0,0,0,0.2)",
                                    boxShadow: selected ? "inset 0 0 20px rgba(245,217,106,0.04)" : "none",
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span className="text-xl shrink-0">{isFilecoin ? "\u{1F310}" : "\u27E0"}</span>
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold truncate" style={{ color: selected ? "#f5d96a" : "#a89060" }}>
                                          {n.name}
                                        </div>
                                        <div className="text-[9px] font-mono text-[#a89060] truncate">
                                          {n.identityRegistry.slice(0, 6)}…{n.identityRegistry.slice(-4)}
                                        </div>
                                        <div className="text-[9px] text-[#8a7a4a] mt-0.5">{n.explorerName}</div>
                                      </div>
                                    </div>
                                    {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#f5d96a]" style={{ boxShadow: "0 0 6px rgba(245,217,106,0.5)" }} />}
                                  </div>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setRegStep(2)}
                              className="w-full py-2.5 rounded border border-[#5a4a2a] text-[#f5d96a] text-sm font-medium hover:bg-[#5a4a2a]/30 hover:border-[#f5d96a]/50 transition-colors mt-2"
                              style={{ fontFamily: "Cinzel, serif", textShadow: "0 0 8px rgba(245,217,106,0.3)" }}
                            >
                              Continue
                            </button>
                          </div>
                        )}

                        {/* Step 2: Enter URLs & Verify */}
                        {regStep === 2 && (
                          <div className="space-y-3">
                            <div className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>
                              Inscribe & Verify
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs text-[#a89060]">Agent Card URL *</label>
                              <input
                                type="url"
                                placeholder="https://your-agent.vercel.app/api/agent-card"
                                value={regCardUrl}
                                onChange={(e) => { setRegCardUrl(e.target.value); setRegValidation(null); }}
                                className="w-full px-3 py-2 rounded border border-[#5a4a2a]/60 bg-black/30 text-[#c0b090] text-sm font-mono placeholder:text-[#3a3020] focus:outline-none focus:border-[#f5d96a]/40"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs text-[#a89060]">
                                Health URL <span className="text-[#5a4a2a]">(optional)</span>
                              </label>
                              <input
                                type="url"
                                placeholder="https://your-agent.vercel.app/api/health"
                                value={regHealthUrl}
                                onChange={(e) => { setRegHealthUrl(e.target.value); setRegValidation(null); }}
                                className="w-full px-3 py-2 rounded border border-[#5a4a2a]/60 bg-black/30 text-[#c0b090] text-sm font-mono placeholder:text-[#3a3020] focus:outline-none focus:border-[#f5d96a]/40"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleRegVerify}
                              disabled={!regCardUrl.trim() || regValidating}
                              className="w-full py-2.5 rounded border border-[#5a4a2a] text-sm font-medium transition-all disabled:opacity-40"
                              style={{
                                color: regValidating ? "#5a4a2a" : "#e8a030",
                                background: regValidating ? "rgba(0,0,0,0.3)" : "rgba(232,160,48,0.06)",
                              }}
                            >
                              {regValidating ? "Scrying..." : "Verify Agent"}
                            </button>

                            {/* Validation results */}
                            {regValidation && (
                              <div
                                className="rounded border p-3 space-y-2"
                                style={{
                                  borderColor: regValidation.valid ? "rgba(245,217,106,0.3)" : "rgba(239,68,68,0.3)",
                                  background: regValidation.valid ? "rgba(245,217,106,0.04)" : "rgba(239,68,68,0.05)",
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span style={{ color: regValidation.valid ? "#f5d96a" : "#ef4444" }}>
                                    {regValidation.valid ? "&#10003;" : "&#10007;"}
                                  </span>
                                  <span className="text-sm font-bold" style={{ color: regValidation.valid ? "#f5d96a" : "#ef4444" }}>
                                    {regValidation.valid ? "Scrying successful" : "Scrying failed"}
                                  </span>
                                </div>

                                {regValidation.agentCard && (
                                  <div className="mt-2 space-y-1.5 p-2 rounded border border-[#5a4a2a]/30" style={{ background: "rgba(0,0,0,0.2)" }}>
                                    <div className="text-xs text-[#c0b090]">
                                      <span className="text-[#7a6a4a]">Name: </span>
                                      {regValidation.agentCard.name}
                                    </div>
                                    <div className="text-xs text-[#c0b090]">
                                      <span className="text-[#7a6a4a]">Description: </span>
                                      {regValidation.agentCard.description?.slice(0, 100)}{regValidation.agentCard.description?.length > 100 ? "..." : ""}
                                    </div>
                                    <div className="text-xs">
                                      <span className="text-[#7a6a4a]">Health: </span>
                                      <span className={regValidation.health ? "text-emerald-500" : "text-red-500"}>
                                        {regValidation.health ? "Alive" : "Unresponsive"}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {regValidation.errors.length > 0 && (
                                  <div className="space-y-1 mt-1">
                                    {regValidation.errors.map((err, i) => (
                                      <div key={i} className="text-[11px] text-red-400">- {err}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => setRegStep(1)}
                                className="flex-1 py-2 rounded border border-[#5a4a2a] text-[#a89060] text-sm hover:bg-[#5a4a2a]/20 transition-colors"
                              >
                                Back
                              </button>
                              <button
                                type="button"
                                onClick={() => setRegStep(3)}
                                disabled={!regValidation?.valid}
                                className="flex-1 py-2 rounded border border-[#5a4a2a] text-[#f5d96a] text-sm font-medium hover:bg-[#5a4a2a]/30 hover:border-[#f5d96a]/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                style={{ fontFamily: "Cinzel, serif" }}
                              >
                                Continue
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Step 3: Register On-Chain */}
                        {regStep === 3 && (
                          <div className="space-y-4">
                            <div className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>
                              Seal the Covenant
                            </div>

                            {/* Summary */}
                            <div className="rounded border border-[#5a4a2a]/50 overflow-hidden">
                              <div className="px-3 py-2 border-b border-[#5a4a2a]/40" style={{ background: "rgba(0,0,0,0.2)" }}>
                                <span className="text-[9px] text-[#a89060] uppercase tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>Covenant Summary</span>
                              </div>
                              <div className="divide-y divide-[#5a4a2a]/30">
                                <div className="flex justify-between px-3 py-2">
                                  <span className="text-xs text-[#a89060]">Network</span>
                                  <span className="text-xs text-[#f5d96a] font-bold">{regNetworkConfig.name}</span>
                                </div>
                                {regValidation?.agentCard?.name && (
                                  <div className="flex justify-between px-3 py-2">
                                    <span className="text-xs text-[#a89060]">Agent</span>
                                    <span className="text-xs text-[#c0b090] font-bold">{regValidation.agentCard.name}</span>
                                  </div>
                                )}
                                <div className="flex justify-between px-3 py-2">
                                  <span className="text-xs text-[#a89060]">Agent Card</span>
                                  <span className="text-[10px] text-[#7a6a4a] font-mono truncate ml-4 max-w-[250px]">{regCardUrl}</span>
                                </div>
                                <div className="flex justify-between px-3 py-2">
                                  <span className="text-xs text-[#a89060]">Contract</span>
                                  <span className="text-[10px] text-[#7a6a4a] font-mono">{regNetworkConfig.identityRegistry.slice(0, 14)}...</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleRegSubmit}
                              disabled={!regValidation?.valid || regIsWriting || regIsConfirming}
                              className="w-full py-3 rounded text-sm font-bold transition-all disabled:opacity-40"
                              style={{
                                fontFamily: "Cinzel, serif",
                                background: "linear-gradient(135deg, rgba(245,217,106,0.15), rgba(232,160,48,0.1))",
                                border: "1px solid rgba(245,217,106,0.35)",
                                color: "#f5d96a",
                                textShadow: "0 0 12px rgba(245,217,106,0.4)",
                                boxShadow: "0 0 20px rgba(245,217,106,0.06), inset 0 0 15px rgba(245,217,106,0.03)",
                              }}
                            >
                              {regIsWriting ? "Awaiting Seal..." : regIsConfirming ? "Forging..." : `Register on ${regNetworkConfig.name}`}
                            </button>

                            {regWriteError && (
                              <div className="p-3 rounded border-l-2 border-red-500/40 text-[11px] text-red-400" style={{ background: "rgba(0,0,0,0.3)" }}>
                                {regWriteError.message?.split("\n")[0]}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setRegStep(2)}
                              className="w-full py-2 rounded border border-[#5a4a2a] text-[#a89060] text-sm hover:bg-[#5a4a2a]/20 transition-colors"
                            >
                              Back
                            </button>
                          </div>
                        )}
                      </>
                    )}

                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Mobile virtual controls — joysticks, visible only on mobile */}
        <div className="md:hidden absolute inset-0 pointer-events-none z-10">
          <VirtualJoystick axis="pan" onValue={setJoystick} side="left" />
          <VirtualJoystick axis="rotate" onValue={setJoystick} side="right" />
        </div>

        <button
          type="button"
          onClick={() => setShowControlsModal(true)}
          className="absolute left-3 top-3 md:top-auto md:bottom-3 p-2.5 sm:p-3 rounded-full text-[#a89060] hover:text-[#f5d96a] hover:bg-[rgba(245,217,106,0.12)] transition-colors focus:outline-none focus:ring-2 focus:ring-[#f5d96a]/40 z-10 pointer-events-auto"
          aria-label="World controls"
        >
          <Info className="size-6 md:size-9" strokeWidth={1.5} />
        </button>

        <Dialog open={showControlsModal} onOpenChange={setShowControlsModal}>
          <DialogContent className="sm:max-w-lg bg-[#1a1612] border-[#5a4a2a]/50">
            <DialogHeader>
              <DialogTitle className="text-[#f5d96a] tracking-widest" style={{ fontFamily: "Cinzel, serif" }}>
                World Controls
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-[#e8dcc8]">
              <div className="grid gap-3 text-base leading-relaxed">
                <div className="flex items-center gap-3">
                  <kbd className="px-2.5 py-1 rounded bg-[#2a2520] border border-[#5a4a2a] text-[#f5d96a] font-mono text-sm">Left-click</kbd>
                  <span>Select agent or object</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2.5 py-1 rounded bg-[#2a2520] border border-[#5a4a2a] text-[#f5d96a] font-mono text-sm">Right-drag</kbd>
                  <span>Rotate camera</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2.5 py-1 rounded bg-[#2a2520] border border-[#5a4a2a] text-[#f5d96a] font-mono text-sm">Scroll</kbd>
                  <span>Zoom in / out</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2.5 py-1 rounded bg-[#2a2520] border border-[#5a4a2a] text-[#f5d96a] font-mono text-sm">WASD</kbd>
                  <span>Pan camera</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2.5 py-1 rounded bg-[#2a2520] border border-[#5a4a2a] text-[#f5d96a] font-mono text-sm">Q / E</kbd>
                  <span>Rotate camera (alternative)</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2.5 py-1 rounded bg-[#2a2520] border border-[#5a4a2a] text-[#f5d96a] font-mono text-sm">Double-click</kbd>
                  <span>Follow selected agent</span>
                </div>
              </div>
              <div className="pt-3 border-t border-[#5a4a2a]/40">
                <div className="text-sm font-medium text-[#f5d96a] mb-2">Mobile</div>
                <div className="grid gap-2 text-sm text-[#c8b898]">
                  <div>One-finger drag — rotate camera</div>
                  <div>Two-finger drag — pan</div>
                  <div>Two-finger pinch — zoom</div>
                  <div>Left joystick — pan</div>
                  <div>Right joystick — rotate camera</div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
  castleGltf: { scene: any },
  filecoinGltf: { scene: any },
  furnaceGltf: { scene: any },
  onStorageDepotClick: () => void,
  onFurnaceClick: () => void
) {
  const initialData = dataRef.current;
  const WORLD_SIZE = 48;
  const CASTLE_FLAT_CENTER = { x: 0, z: 12 };
  const CASTLE_FLAT_RADIUS = 10;
  const H = (x: number, z: number) => {
    const dx = x - CASTLE_FLAT_CENTER.x;
    const dz = z - CASTLE_FLAT_CENTER.z;
    if (dx * dx + dz * dz < CASTLE_FLAT_RADIUS * CASTLE_FLAT_RADIUS) return 0;
    return (
      (Math.sin(x * 0.05) * Math.cos(z * 0.07) * 2 +
        Math.sin(x * 0.12 + z * 0.08) * 1.5 +
        Math.cos(z * 0.03) * 3) *
      0.15
    );
  };

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
  scene.fog = new THREE.FogExp2(0x1a1520, 0.008);
  scene.background = new THREE.Color(0x0d0a15);
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);

  // Orbit camera — isometric-style top-down view (phi ~60° from vertical, theta 45°)
  const ISO_PHI = Math.PI / 3;
  const ISO_THETA = Math.PI / 4;
  const PAN_BOUND = WORLD_SIZE / 2 - 4;
  const orbit = {
    target: new THREE.Vector3(0, 0, 0),
    smooth: new THREE.Vector3(0, 0, 0),
    dist: 32,
    tDist: 32,
    phi: ISO_PHI,
    tPhi: ISO_PHI,
    theta: ISO_THETA,
    tTheta: ISO_THETA,
    draggingRot: false,
    draggingPan: false,
    last: { x: 0, y: 0 },
  };

  function updateCamera() {
    orbit.dist += (orbit.tDist - orbit.dist) * 0.1;
    orbit.phi += (orbit.tPhi - orbit.phi) * 0.12;
    orbit.theta += (orbit.tTheta - orbit.theta) * 0.12;
    orbit.smooth.lerp(orbit.target, 0.08);
    orbit.target.x = Math.max(-PAN_BOUND, Math.min(PAN_BOUND, orbit.target.x));
    orbit.target.z = Math.max(-PAN_BOUND, Math.min(PAN_BOUND, orbit.target.z));
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
      orbit.tPhi = Math.max(ISO_PHI - 0.2, Math.min(ISO_PHI + 0.2, orbit.tPhi - dy * 0.005));
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
      orbit.tDist = Math.max(18, Math.min(42, orbit.tDist * (1 + e.deltaY * 0.001)));
    },
    { passive: false }
  );

  const keys: Record<string, boolean> = {};
  const mobileKeys: Record<string, boolean> = {};
  const mobileJoystick = { panX: 0, panY: 0, rotate: 0 };
  (container as unknown as { __aetheriaMobileKeys?: Record<string, boolean> }).__aetheriaMobileKeys = mobileKeys;
  (container as unknown as { __aetheriaMobileJoystick?: { panX: number; panY: number; rotate: number } }).__aetheriaMobileJoystick = mobileJoystick;

  window.addEventListener("keydown", (e) => {
    const k = e.key?.toLowerCase?.();
    if (k) keys[k] = true;
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key?.toLowerCase?.();
    if (k) keys[k] = false;
  });

  // Touch: one-finger drag = rotate, two-finger = pan, pinch = zoom
  let touchRotateId: number | null = null;
  let touchPanIds: number[] = [];
  let touchZoomDist = 0;
  function getTouch(e: TouchEvent, id: number) {
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === id) return e.touches[i];
    }
    return null;
  }
  function dist(a: Touch, b: Touch) {
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1 && touchRotateId === null) {
      touchRotateId = e.touches[0].identifier;
      orbit.draggingRot = true;
      orbit.last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && touchPanIds.length === 0) {
      touchPanIds = [e.touches[0].identifier, e.touches[1].identifier];
      touchZoomDist = dist(e.touches[0], e.touches[1]);
      orbit.draggingPan = true;
      orbit.last = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (touchRotateId !== null) {
      const t = getTouch(e, touchRotateId);
      if (t) {
        const dx = t.clientX - orbit.last.x;
        const dy = t.clientY - orbit.last.y;
        orbit.tTheta -= dx * 0.005;
        orbit.tPhi = Math.max(ISO_PHI - 0.2, Math.min(ISO_PHI + 0.2, orbit.tPhi - dy * 0.005));
        orbit.last = { x: t.clientX, y: t.clientY };
      }
    } else if (touchPanIds.length === 2) {
      const t0 = getTouch(e, touchPanIds[0]);
      const t1 = getTouch(e, touchPanIds[1]);
      if (t0 && t1) {
        const cx = (t0.clientX + t1.clientX) / 2;
        const cy = (t0.clientY + t1.clientY) / 2;
        const dx = cx - orbit.last.x;
        const dy = cy - orbit.last.y;
        const s = orbit.dist * 0.002;
        const sinT = Math.sin(orbit.theta);
        const cosT = Math.cos(orbit.theta);
        orbit.target.x += (-dx * cosT - dy * sinT) * s;
        orbit.target.z += (dx * sinT - dy * cosT) * s;
        orbit.last = { x: cx, y: cy };
        const d = dist(t0, t1);
        const zoomDelta = (touchZoomDist - d) * 0.01;
        orbit.tDist = Math.max(18, Math.min(42, orbit.tDist + zoomDelta));
        touchZoomDist = d;
      }
    }
  }, { passive: true });
  canvas.addEventListener("touchend", (e) => {
    if (touchRotateId !== null && !getTouch(e, touchRotateId)) {
      touchRotateId = null;
      orbit.draggingRot = false;
    }
    if (touchPanIds.length === 2) {
      const has0 = getTouch(e, touchPanIds[0]);
      const has1 = getTouch(e, touchPanIds[1]);
      if (!has0 || !has1) {
        touchPanIds = [];
        orbit.draggingPan = false;
      }
    }
  }, { passive: true });
  canvas.addEventListener("touchcancel", () => {
    touchRotateId = null;
    touchPanIds = [];
    orbit.draggingRot = false;
    orbit.draggingPan = false;
  }, { passive: true });

  function processKeys(dt: number) {
    const k = (key: string) => keys[key] || mobileKeys[key];
    const j = (container as unknown as { __aetheriaMobileJoystick?: { panX: number; panY: number; rotate: number } })?.__aetheriaMobileJoystick;
    const p = 20 * dt;
    const sinT = Math.sin(orbit.theta);
    const cosT = Math.cos(orbit.theta);
    let mx = 0;
    let mz = 0;
    if (j && (j.panX !== 0 || j.panY !== 0)) {
      mx = -j.panY * sinT - j.panX * cosT;
      mz = -j.panY * cosT + j.panX * sinT;
    } else {
      if (k("w") || keys["arrowup"]) { mx -= sinT; mz -= cosT; }
      if (k("s") || keys["arrowdown"]) { mx += sinT; mz += cosT; }
      if (k("a") || keys["arrowleft"]) { mx -= cosT; mz += sinT; }
      if (k("d") || keys["arrowright"]) { mx += cosT; mz -= sinT; }
    }
    if (mx || mz) {
      orbit.target.x += mx * p;
      orbit.target.z += mz * p;
    }
    let rot = 0;
    if (j && j.rotate !== 0) {
      rot = -j.rotate * 1.5 * dt;
    } else {
      if (k("q")) rot += 1.5 * dt;
      if (k("e")) rot -= 1.5 * dt;
    }
    orbit.tTheta += rot;
  }

  // Lighting
  scene.add(new THREE.AmbientLight(0x3a3060, 0.8));
  const hemiLight = new THREE.HemisphereLight(0x5577aa, 0x2a5a2a, 0.6);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.5);
  dirLight.position.set(30, 50, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -35;
  dirLight.shadow.camera.right = 35;
  dirLight.shadow.camera.top = 35;
  dirLight.shadow.camera.bottom = -35;
  dirLight.shadow.bias = -0.0001;
  scene.add(dirLight);
  const ml = new THREE.DirectionalLight(0x4466aa, 0.45);
  ml.position.set(-20, 40, -30);
  scene.add(ml);
  const frontFill = new THREE.DirectionalLight(0xccaa88, 0.35);
  frontFill.position.set(0, 30, -40);
  scene.add(frontFill);

  // Terrain — higher resolution, smoother
  const terrainGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 140, 140);
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

  // Ancient walls — stone perimeter boxing the world for isometric view
  const WALL_H = 3.5;
  const WALL_T = 1.2;
  const HALF = WORLD_SIZE / 2;
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });
  const wallMatAlt = new THREE.MeshStandardMaterial({
    color: 0x2a2018,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });
  const wallSegLen = 4;
  const numSegs = Math.ceil((WORLD_SIZE + WALL_T) / wallSegLen);
  [-HALF - WALL_T / 2, HALF + WALL_T / 2].forEach((edge, i) => {
    for (let s = 0; s < numSegs; s++) {
      const t = (s - (numSegs - 1) / 2) * wallSegLen;
      const base = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, wallSegLen + 0.2), wallMat);
      base.position.set(edge, WALL_H / 2, t);
      base.castShadow = true;
      base.receiveShadow = true;
      scene.add(base);
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(WALL_T * 1.1, WALL_H * 0.4, wallSegLen * 0.4), wallMatAlt);
      merlon.position.set(edge, WALL_H + WALL_H * 0.2, t);
      merlon.castShadow = true;
      scene.add(merlon);
    }
  });
  [-HALF - WALL_T / 2, HALF + WALL_T / 2].forEach((edge, i) => {
    for (let s = 0; s < numSegs; s++) {
      const t = (s - (numSegs - 1) / 2) * wallSegLen;
      const base = new THREE.Mesh(new THREE.BoxGeometry(wallSegLen + 0.2, WALL_H, WALL_T), wallMat);
      base.position.set(t, WALL_H / 2, edge);
      base.castShadow = true;
      base.receiveShadow = true;
      scene.add(base);
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(wallSegLen * 0.4, WALL_H * 0.4, WALL_T * 1.1), wallMatAlt);
      merlon.position.set(t, WALL_H + WALL_H * 0.2, edge);
      merlon.castShadow = true;
      scene.add(merlon);
    }
  });

  // Rocks — 12 blue-grey crystalline boulders (sci-fi)
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.82;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.82;
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    if (Math.abs(x) < 5 && Math.abs(z - 12) < 5) continue;
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
  const STORAGE_POS = { x: 0, z: 12 };
  const storageGroup = new THREE.Group();
  const ty = H(STORAGE_POS.x, STORAGE_POS.z);

  const matGlow = new THREE.MeshStandardMaterial({ color: FIL_BLUE, emissive: FIL_BLUE, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.2 });

  // Castle model — scale to target height of ~8 units
  const castleScene = castleGltf.scene.clone(true);
  const castleBox = new THREE.Box3().setFromObject(castleScene);
  const castleHeight = castleBox.max.y - castleBox.min.y;
  const TARGET_CASTLE_HEIGHT = 8;
  const castleScale = TARGET_CASTLE_HEIGHT / castleHeight;
  castleScene.scale.setScalar(castleScale);
  // Recompute box after scaling to sit flush on the ground
  const castleBox2 = new THREE.Box3().setFromObject(castleScene);
  castleScene.position.y = -castleBox2.min.y;
  // Darker stone palette matching world: base 0x4a3a2a, accent 0x3a2a1a
  const CASTLE_COLORS = [0x4a3a2a, 0x3a2a1a, 0x352818];
  let meshIdx = 0;
  castleScene.traverse((obj: any) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats: any[] = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat: any) => {
        if (!mat) return;
        const m = mat.clone();
        m.color.setHex(CASTLE_COLORS[meshIdx % CASTLE_COLORS.length]);
        m.roughness = 0.85;
        m.metalness = 0.1;
        if (Array.isArray(obj.material)) {
          const idx = obj.material.indexOf(mat);
          obj.material[idx] = m;
        } else {
          obj.material = m;
        }
      });
      meshIdx++;
    }
  });
  storageGroup.add(castleScene);

  const POST_H = TARGET_CASTLE_HEIGHT * 0.6; // reference height for overlay positioning

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
  signCanvas.height = 200;
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: signTex, transparent: true, depthTest: false })
  );
  signSprite.position.set(0, TARGET_CASTLE_HEIGHT - 0.6, 2.9);
  signSprite.scale.set(3.5, 1.4, 1);
  storageGroup.add(signSprite);
  storageGroup.position.set(STORAGE_POS.x, ty, STORAGE_POS.z);
  storageGroup.rotation.y = Math.PI; // face inward toward world center
  scene.add(storageGroup);

  // ── Filecoin model hovering and spinning above the castle ──
  const filecoinScene = filecoinGltf.scene.clone(true);
  const filBox = new THREE.Box3().setFromObject(filecoinScene);
  const filHeight = filBox.max.y - filBox.min.y;
  const TARGET_FIL_HEIGHT = 2;
  const filScale = TARGET_FIL_HEIGHT / (filHeight || 1);
  filecoinScene.scale.setScalar(filScale);
  const filecoinMaterials: any[] = [];
  filecoinScene.traverse((obj: any) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats: any[] = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat: any) => {
        if (!mat) return;
        const m = mat.clone();
        m.color.setHex(0x1a8fff);
        m.emissive = new THREE.Color(0x0055ff);
        m.emissiveIntensity = 1.0;
        m.toneMapped = false;
        filecoinMaterials.push(m);
        if (Array.isArray(obj.material)) {
          const idx = (obj.material as any[]).indexOf(mat);
          obj.material[idx] = m;
        } else {
          obj.material = m;
        }
      });
    }
  });
  const filecoinGroup = new THREE.Group();
  filecoinGroup.add(filecoinScene);
  // Position above castle top
  const filHoverBaseY = TARGET_CASTLE_HEIGHT + 0.5;
  filecoinGroup.position.set(STORAGE_POS.x, ty + filHoverBaseY, STORAGE_POS.z);
  scene.add(filecoinGroup);

  // Blue glow lights around the filecoin
  const filGlowCore = new THREE.PointLight(0x0077ff, 3, 10);
  filGlowCore.position.set(STORAGE_POS.x, ty + filHoverBaseY, STORAGE_POS.z);
  scene.add(filGlowCore);
  const filGlowWide = new THREE.PointLight(0x0044cc, 1.5, 18);
  filGlowWide.position.set(STORAGE_POS.x, ty + filHoverBaseY - 1, STORAGE_POS.z);
  scene.add(filGlowWide);

  // ── Filecoin Onchain Cloud card — blue glowing card at top ──
  const STATUS_CARD_W = 5;
  const STATUS_CARD_H = 2.4;
  const statusCardCanvas = document.createElement("canvas");
  statusCardCanvas.width = 800;
  statusCardCanvas.height = 384;

  function renderStatusCard() {
    const ctx = statusCardCanvas.getContext("2d")!;
    const w = statusCardCanvas.width;
    const h = statusCardCanvas.height;
    const d = dataRef.current;

    const glow = (color: string, blur: number) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    };
    const noGlow = () => {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    };

    // Background — dark blue gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "rgba(2,8,24,0.97)");
    grad.addColorStop(0.5, "rgba(4,16,48,0.95)");
    grad.addColorStop(1, "rgba(2,12,28,0.96)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    const r = 12;
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.fill();

    // Outer glow border
    ctx.strokeStyle = "rgba(0,144,255,0.7)";
    ctx.lineWidth = 6;
    glow("rgba(0,144,255,0.95)", 30);
    ctx.stroke();
    noGlow();

    // Inner glow border
    ctx.strokeStyle = "rgba(80,180,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const m = 8;
    ctx.moveTo(r + m, m);
    ctx.lineTo(w - r - m, m);
    ctx.quadraticCurveTo(w - m, m, w - m, r + m);
    ctx.lineTo(w - m, h - r - m);
    ctx.quadraticCurveTo(w - m, h - m, w - r - m, h - m);
    ctx.lineTo(r + m, h - m);
    ctx.quadraticCurveTo(m, h - m, m, h - r - m);
    ctx.lineTo(m, r + m);
    ctx.quadraticCurveTo(m, m, r + m, m);
    glow("rgba(0,144,255,0.9)", 18);
    ctx.stroke();
    noGlow();

    ctx.textAlign = "center";

    // Title — Filecoin Onchain Cloud
    ctx.font = "bold 42px MedievalSharp";
    ctx.fillStyle = "#60b8ff";
    glow("rgba(0,144,255,0.95)", 40);
    ctx.fillText("Filecoin Onchain Cloud", w / 2, 68);
    noGlow();

    // Storage & Revenue
    ctx.font = "bold 30px MedievalSharp";
    ctx.fillStyle = "#a0d8ff";
    glow("rgba(0,144,255,0.9)", 28);
    ctx.fillText(
      `Storage: ${formatTFil(d.summary.totalStorageCostWei)} tFIL · Revenue: $${formatUsd(d.summary.totalRevenueUsdCents)}`,
      w / 2,
      120
    );
    noGlow();

    // Status row
    ctx.font = "bold 24px MedievalSharp";
    ctx.fillStyle = "#70a8d0";
    glow("rgba(0,144,255,0.6)", 12);
    ctx.fillText(
      `Healthy: ${d.summary.activeAgents} · At-Risk: ${d.summary.atRiskAgents} · Wound: ${d.summary.windDownCount}`,
      w / 2,
      168
    );
    noGlow();
  }

  renderStatusCard();
  const statusCardTex = new THREE.CanvasTexture(statusCardCanvas);
  statusCardTex.needsUpdate = true;

  const statusCardMat = new THREE.MeshStandardMaterial({
    map: statusCardTex,
    transparent: true,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide,
    emissive: 0x0066cc,
    emissiveIntensity: 0.6,
    toneMapped: false,
  });
  const statusCardGeo = new THREE.PlaneGeometry(STATUS_CARD_W, STATUS_CARD_H);
  const statusCardMesh = new THREE.Mesh(statusCardGeo, statusCardMat);

  const statusCardGroup = new THREE.Group();
  statusCardGroup.add(statusCardMesh);

  // Position at top — above castle and filecoin model
  const statusCardBaseY = TARGET_CASTLE_HEIGHT + 6;
  statusCardGroup.position.set(STORAGE_POS.x, ty + statusCardBaseY, STORAGE_POS.z);
  scene.add(statusCardGroup);

  // Strong blue glow lights around the card
  const cardGlowCore = new THREE.PointLight(0x0088ff, 4, 12);
  cardGlowCore.position.set(0, 0, 2);
  statusCardGroup.add(cardGlowCore);
  const cardGlowWide = new THREE.PointLight(0x0044cc, 2.5, 18);
  cardGlowWide.position.set(0, 0, 4);
  statusCardGroup.add(cardGlowWide);

  // ── 3D Economy Board — stock-market style digital display ──────────────────
  const ECON_BOARD_POS = { x: -10, z: -10 };
  const ECON_BOARD_W = 15;
  const ECON_BOARD_H = 8.8;
  const econBoardCanvas = document.createElement("canvas");
  econBoardCanvas.width = 1280;
  econBoardCanvas.height = 750;

  function renderEconBoard() {
    const ctx = econBoardCanvas.getContext("2d")!;
    const w = econBoardCanvas.width;
    const h = econBoardCanvas.height;
    const d = dataRef.current;

    // Dark background — warm parchment-dark
    ctx.fillStyle = "#0f0a05";
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines (ledger style)
    ctx.strokeStyle = "rgba(245,217,106,0.06)";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 37) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let x = 0; x < w; x += 37) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Scanline effect
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, y, w, 1);
    }

    // Border glow — gold
    ctx.strokeStyle = "rgba(245,217,106,0.5)";
    ctx.lineWidth = 5;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.strokeStyle = "rgba(168,144,96,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // ── Header bar ──
    const headerGrad = ctx.createLinearGradient(0, 0, w, 0);
    headerGrad.addColorStop(0, "rgba(245,217,106,0.1)");
    headerGrad.addColorStop(0.5, "rgba(245,217,106,0.2)");
    headerGrad.addColorStop(1, "rgba(245,217,106,0.1)");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(6, 6, w - 12, 55);

    ctx.font = "bold 35px Cinzel, serif";
    ctx.fillStyle = "#f5d96a";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(245,217,106,0.6)";
    ctx.shadowBlur = 14;
    ctx.fillText("FILCRAFT EXCHANGE", w / 2, 47);
    ctx.shadowBlur = 0;

    // Separator
    ctx.fillStyle = "rgba(245,217,106,0.3)";
    ctx.fillRect(10, 67, w - 20, 1);

    // ── Live Stats Ticker ──
    const tickerY = 92;
    ctx.font = "bold 16px monospace";
    const stats = [
      { label: "HEALTHY", value: String(d.summary.activeAgents), color: "#10b981" },
      { label: "AT-RISK", value: String(d.summary.atRiskAgents), color: "#f59e0b" },
      { label: "WOUND DOWN", value: String(d.summary.windDownCount), color: "#6b7280" },
      { label: "STORAGE", value: formatTFil(d.summary.totalStorageCostWei) + " tFIL", color: "#f5d96a" },
      { label: "REVENUE", value: "$" + formatUsd(d.summary.totalRevenueUsdCents), color: "#a78bfa" },
    ];
    const tickerSpacing = (w - 40) / stats.length;
    stats.forEach((s, i) => {
      const tx = 37 + i * tickerSpacing;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(160,140,100,0.7)";
      ctx.font = "bold 16px monospace";
      ctx.fillText(s.label, tx, tickerY - 2);
      ctx.fillStyle = s.color;
      ctx.font = "bold 25px monospace";
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8;
      ctx.fillText(s.value, tx, tickerY + 25);
      ctx.shadowBlur = 0;
    });

    // Separator
    ctx.fillStyle = "rgba(245,217,106,0.2)";
    ctx.fillRect(10, tickerY + 42, w - 20, 1);

    // ── Agent P&L Table ──
    const tableY = tickerY + 60;
    ctx.font = "bold 19px Cinzel, serif";
    ctx.fillStyle = "rgba(245,217,106,0.6)";
    ctx.textAlign = "left";
    ctx.fillText("AGENT P&L", 25, tableY);

    // Column headers
    const colX = { name: 25, runs: 300, revenue: 475, storage: 662, balance: 850, status: 1050 };
    const headerRowY = tableY + 27;
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "rgba(160,140,100,0.5)";
    ctx.textAlign = "left";
    ctx.fillText("AGENT", colX.name, headerRowY);
    ctx.textAlign = "right";
    ctx.fillText("RUNS", colX.runs, headerRowY);
    ctx.fillText("REVENUE", colX.revenue, headerRowY);
    ctx.fillText("STORAGE", colX.storage, headerRowY);
    ctx.fillText("BALANCE", colX.balance, headerRowY);
    ctx.textAlign = "center";
    ctx.fillText("STATUS", colX.status, headerRowY);

    // Separator
    ctx.fillStyle = "rgba(245,217,106,0.15)";
    ctx.fillRect(15, headerRowY + 10, w - 30, 1);

    // Rows
    const sorted = [...d.agentRows].sort((a, b) => Number(BigInt(b.economy.totalSpent) - BigInt(a.economy.totalSpent)));
    sorted.forEach((row, idx) => {
      const ry = headerRowY + 35 + idx * 40;
      if (ry > h - 250) return; // don't overflow into activity section
      const statusCol = row.economy.status === "healthy" ? "#10b981" : row.economy.status === "at-risk" ? "#f59e0b" : "#6b7280";
      const statusLabel = row.economy.status === "healthy" ? "HEALTHY" : row.economy.status === "at-risk" ? "AT RISK" : "WOUND DN";

      // Alternating row stripes
      if (idx % 2 === 0) {
        ctx.fillStyle = "rgba(245,217,106,0.04)";
        ctx.fillRect(15, ry - 22, w - 30, 37);
      }

      ctx.font = "bold 19px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#d4d4d8";
      ctx.fillText(row.name, colX.name, ry);
      ctx.fillStyle = "rgba(160,140,100,0.4)";
      ctx.font = "15px monospace";
      ctx.fillText(`#${row.agentId}`, colX.name + ctx.measureText(row.name).width + 12, ry);

      ctx.font = "bold 19px monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = row.completedRuns > 0 ? "#e4e4e7" : "#52525b";
      ctx.fillText(String(row.completedRuns), colX.runs, ry);

      ctx.fillStyle = "#a78bfa";
      ctx.fillText("$" + formatUsd(row.economy.totalEarned), colX.revenue, ry);

      ctx.fillStyle = "#f5d96a";
      ctx.fillText(formatTFil(row.economy.totalSpent), colX.storage, ry);

      ctx.fillStyle = "#e8a030";
      ctx.fillText(formatTFil(row.economy.balance), colX.balance, ry);

      ctx.textAlign = "center";
      ctx.fillStyle = statusCol;
      ctx.shadowColor = statusCol;
      ctx.shadowBlur = 5;
      ctx.font = "bold 16px monospace";
      ctx.fillText(statusLabel, colX.status, ry);
      ctx.shadowBlur = 0;
    });

    // ── Bottom section: Activity + Leaderboard ──
    const bottomY = h - 237;

    // Separator
    ctx.fillStyle = "rgba(245,217,106,0.2)";
    ctx.fillRect(10, bottomY - 10, w - 20, 1);

    // ── Recent Activity (left half) ──
    ctx.font = "bold 19px Cinzel, serif";
    ctx.fillStyle = "rgba(245,217,106,0.6)";
    ctx.textAlign = "left";
    ctx.fillText("RECENT ACTIVITY", 25, bottomY + 12);

    const recentEvents = d.events.slice(0, 5);
    recentEvents.forEach((ev, i) => {
      const ey = bottomY + 40 + i * 35;
      const evColor = ev.type === "BudgetDeposited" ? "#10b981"
        : ev.type === "StorageCostRecorded" ? "#f5d96a"
        : ev.type === "RevenueRecorded" ? "#a78bfa"
        : "#6b7280";

      // Event indicator dot
      ctx.fillStyle = evColor;
      ctx.shadowColor = evColor;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(35, ey - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = "16px monospace";
      ctx.fillStyle = "#a1a1aa";
      ctx.textAlign = "left";
      const desc = eventDescription(ev);
      ctx.fillText(desc.length > 60 ? desc.slice(0, 60) + "..." : desc, 55, ey);

      // Block number
      ctx.font = "14px monospace";
      ctx.fillStyle = "rgba(100,100,120,0.5)";
      ctx.fillText(`#${ev.blockNumber}`, 55 + Math.min(ctx.measureText(desc).width + 10, w / 2 - 100), ey);
    });

    // ── Storage Leaderboard (right half) ──
    const lbX = w / 2 + 25;
    ctx.font = "bold 19px Cinzel, serif";
    ctx.fillStyle = "rgba(245,217,106,0.6)";
    ctx.textAlign = "left";
    ctx.fillText("STORAGE LEADERBOARD", lbX, bottomY + 12);

    const leaderboard = [...d.agentRows]
      .sort((a, b) => Number(BigInt(b.economy.totalSpent) - BigInt(a.economy.totalSpent)))
      .slice(0, 5);
    leaderboard.forEach((row, rank) => {
      const ly = bottomY + 40 + rank * 35;
      const statusCol = row.economy.status === "healthy" ? "#10b981" : row.economy.status === "at-risk" ? "#f59e0b" : "#6b7280";

      // Rank
      ctx.font = "bold 27px monospace";
      ctx.fillStyle = "rgba(100,100,120,0.3)";
      ctx.textAlign = "left";
      ctx.fillText(String(rank + 1), lbX, ly + 2);

      // Name
      ctx.font = "bold 19px monospace";
      ctx.fillStyle = "#d4d4d8";
      ctx.fillText(row.name, lbX + 40, ly);

      // Cost + status
      ctx.textAlign = "right";
      ctx.fillStyle = statusCol;
      ctx.font = "bold 19px monospace";
      ctx.shadowColor = statusCol;
      ctx.shadowBlur = 5;
      ctx.fillText(formatTFil(row.economy.totalSpent) + " tFIL", w - 25, ly);
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(100,100,120,0.4)";
      ctx.font = "14px monospace";
      ctx.fillText(row.economy.status, w - 25, ly + 20);
    });

    // ── Timestamp ──
    ctx.font = "14px monospace";
    ctx.fillStyle = "rgba(100,100,120,0.4)";
    ctx.textAlign = "right";
    ctx.fillText("LIVE  " + new Date(d.fetchedAt).toLocaleTimeString(), w - 18, h - 12);

    // Blinking dot
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = "#10b981";
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(w - ctx.measureText("LIVE  " + new Date(d.fetchedAt).toLocaleTimeString()).width - 26, h - 17, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  renderEconBoard();
  const econBoardTex = new THREE.CanvasTexture(econBoardCanvas);
  econBoardTex.needsUpdate = true;

  const econBoardGroup = new THREE.Group();
  const econBoardY = H(ECON_BOARD_POS.x, ECON_BOARD_POS.z);

  // Board screen
  const econScreenMat = new THREE.MeshStandardMaterial({
    map: econBoardTex,
    roughness: 0.15,
    metalness: 0.1,
    emissive: 0x221100,
    emissiveIntensity: 0.8,
    side: THREE.FrontSide,
  });
  const econScreenGeo = new THREE.PlaneGeometry(ECON_BOARD_W, ECON_BOARD_H);
  const econScreen = new THREE.Mesh(econScreenGeo, econScreenMat);
  econScreen.position.set(0, ECON_BOARD_H / 2 + 1.5, 0);
  econBoardGroup.add(econScreen);

  // Frame — dark brass border around the screen
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x201408, metalness: 0.95, roughness: 0.15 });
  const frameThick = 0.15;
  // Top frame
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(ECON_BOARD_W + frameThick * 2, frameThick, 0.3), frameMat);
  frameTop.position.set(0, ECON_BOARD_H / 2 + 1.5 + ECON_BOARD_H / 2 + frameThick / 2, 0);
  econBoardGroup.add(frameTop);
  // Bottom frame
  const frameBot = new THREE.Mesh(new THREE.BoxGeometry(ECON_BOARD_W + frameThick * 2, frameThick, 0.3), frameMat);
  frameBot.position.set(0, ECON_BOARD_H / 2 + 1.5 - ECON_BOARD_H / 2 - frameThick / 2, 0);
  econBoardGroup.add(frameBot);
  // Left frame
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(frameThick, ECON_BOARD_H + frameThick * 2, 0.3), frameMat);
  frameLeft.position.set(-ECON_BOARD_W / 2 - frameThick / 2, ECON_BOARD_H / 2 + 1.5, 0);
  econBoardGroup.add(frameLeft);
  // Right frame
  const frameRight = new THREE.Mesh(new THREE.BoxGeometry(frameThick, ECON_BOARD_H + frameThick * 2, 0.3), frameMat);
  frameRight.position.set(ECON_BOARD_W / 2 + frameThick / 2, ECON_BOARD_H / 2 + 1.5, 0);
  econBoardGroup.add(frameRight);

  // Gold LED strip along the top
  const ledStripMat = new THREE.MeshStandardMaterial({ color: 0xf5d96a, emissive: 0xf5d96a, emissiveIntensity: 1.5, roughness: 0.2 });
  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(ECON_BOARD_W + 0.6, 0.08, 0.08), ledStripMat);
  ledStrip.position.set(0, ECON_BOARD_H / 2 + 1.5 + ECON_BOARD_H / 2 + frameThick + 0.06, 0);
  econBoardGroup.add(ledStrip);

  // Support pillars (two metal poles)
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, metalness: 0.9, roughness: 0.2 });
  [-1, 1].forEach((side) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, ECON_BOARD_H / 2 + 1.5, 8), pillarMat);
    pillar.position.set(side * (ECON_BOARD_W / 2 - 0.5), (ECON_BOARD_H / 2 + 1.5) / 2, -0.1);
    pillar.castShadow = true;
    econBoardGroup.add(pillar);
  });

  // Spotlight illuminating the board
  const boardSpot = new THREE.SpotLight(0xf5d96a, 3, 20, Math.PI / 5);
  boardSpot.position.set(0, ECON_BOARD_H + 4, 5);
  boardSpot.target.position.set(0, ECON_BOARD_H / 2 + 1.5, 0);
  econBoardGroup.add(boardSpot);
  econBoardGroup.add(boardSpot.target);

  // Point light in front of screen for glow effect
  const boardGlow = new THREE.PointLight(0xf5d96a, 1.5, 12);
  boardGlow.position.set(0, ECON_BOARD_H / 2 + 1.5, 2);
  econBoardGroup.add(boardGlow);

  // Position and rotate to face the center of the world
  econBoardGroup.position.set(ECON_BOARD_POS.x, econBoardY, ECON_BOARD_POS.z);
  econBoardGroup.rotation.y = Math.atan2(-ECON_BOARD_POS.x, -ECON_BOARD_POS.z); // face center
  econBoardGroup.traverse((obj: { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean }) => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
  scene.add(econBoardGroup);

  // Label sprite above the board
  const econLabelCanvas = document.createElement("canvas");
  econLabelCanvas.width = 512;
  econLabelCanvas.height = 64;
  const econLabelCtx = econLabelCanvas.getContext("2d")!;
  econLabelCtx.font = "bold 28px MedievalSharp";
  econLabelCtx.fillStyle = "#f5d96a";
  econLabelCtx.textAlign = "center";
  econLabelCtx.shadowColor = "rgba(245,217,106,0.6)";
  econLabelCtx.shadowBlur = 10;
  econLabelCtx.fillText("FilCraft Exchange", 256, 36);
  const econLabelSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(econLabelCanvas), transparent: true, depthTest: false })
  );
  econLabelSprite.position.set(0, ECON_BOARD_H + 2.5, 0);
  econLabelSprite.scale.set(8, 1.5, 1);
  econBoardGroup.add(econLabelSprite);

  // ── Furnace — Register Agent station ────────────────────────────────────────
  const FURNACE_POS = { x: 20, z: -18 };
  const furnaceScene = furnaceGltf.scene.clone(true);
  const furnaceBox = new THREE.Box3().setFromObject(furnaceScene);
  const furnaceHeight = furnaceBox.max.y - furnaceBox.min.y;
  const TARGET_FURNACE_HEIGHT = 3;
  const furnaceScale = TARGET_FURNACE_HEIGHT / (furnaceHeight || 1);
  furnaceScene.scale.setScalar(furnaceScale);
  const furnaceMaterials: { emissive: { setHex: (n: number) => void }; emissiveIntensity: number }[] = [];
  furnaceScene.traverse((obj: any) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats: any[] = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat: any) => {
        if (mat && (mat.isMeshStandardMaterial || mat.isMeshPhongMaterial)) {
          mat.emissive = new THREE.Color(0xff4400);
          mat.emissiveIntensity = 2.5;
          mat.toneMapped = false; // bypass tonemapping so it blooms brighter
          furnaceMaterials.push(mat);
        }
      });
    }
  });
  const furnaceGroup = new THREE.Group();
  furnaceGroup.add(furnaceScene);
  const furnaceY = H(FURNACE_POS.x, FURNACE_POS.z);
  // Sit flush on terrain
  const furnaceBox2 = new THREE.Box3().setFromObject(furnaceScene);
  furnaceScene.position.y = -furnaceBox2.min.y;
  furnaceGroup.position.set(FURNACE_POS.x, furnaceY, FURNACE_POS.z);
  furnaceGroup.rotation.y = Math.atan2(-FURNACE_POS.x, -FURNACE_POS.z); // face inward toward world center
  scene.add(furnaceGroup);

  // Glow ring under the furnace — orange ember color
  const furnaceRing = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.2, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff6010, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  furnaceRing.position.set(FURNACE_POS.x, furnaceY + 0.05, FURNACE_POS.z);
  scene.add(furnaceRing);

  // Inner heat disc — hot core beneath furnace
  const furnaceHeatDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  );
  furnaceHeatDisc.position.set(FURNACE_POS.x, furnaceY + 0.03, FURNACE_POS.z);
  scene.add(furnaceHeatDisc);

  // Label above furnace
  const furnaceLabelCanvas = document.createElement("canvas");
  furnaceLabelCanvas.width = 512;
  furnaceLabelCanvas.height = 96;
  const furnaceLabelCtx = furnaceLabelCanvas.getContext("2d")!;
  furnaceLabelCtx.font = "bold 32px MedievalSharp";
  furnaceLabelCtx.fillStyle = "#10b981";
  furnaceLabelCtx.textAlign = "center";
  furnaceLabelCtx.shadowColor = "rgba(16,185,129,0.6)";
  furnaceLabelCtx.shadowBlur = 10;
  furnaceLabelCtx.fillText("Register Agent", 256, 40);
  furnaceLabelCtx.font = "18px MedievalSharp";
  furnaceLabelCtx.fillStyle = "#a89060";
  furnaceLabelCtx.shadowBlur = 0;
  furnaceLabelCtx.fillText("Click to register", 256, 70);
  const furnaceLabelSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(furnaceLabelCanvas), transparent: true, depthTest: false })
  );
  furnaceLabelSprite.position.set(FURNACE_POS.x, furnaceY + TARGET_FURNACE_HEIGHT + 1.5, FURNACE_POS.z);
  furnaceLabelSprite.scale.set(6, 1.2, 1);
  scene.add(furnaceLabelSprite);

  // Primary fire light — bright orange, wide reach, casts shadows
  const furnaceLight = new THREE.PointLight(0xff6010, 12, 30);
  furnaceLight.castShadow = true;
  furnaceLight.position.set(FURNACE_POS.x, furnaceY + 2, FURNACE_POS.z);
  scene.add(furnaceLight);

  // Inner core light — deep red-white, blazing intensity
  const furnaceFireCore = new THREE.PointLight(0xff3300, 20, 10);
  furnaceFireCore.position.set(FURNACE_POS.x, furnaceY + 1.2, FURNACE_POS.z);
  scene.add(furnaceFireCore);

  // Ambient heat fill — warm orange, fills the surrounding area
  const furnaceHeatFill = new THREE.PointLight(0xff8800, 5, 25);
  furnaceHeatFill.position.set(FURNACE_POS.x, furnaceY + 3, FURNACE_POS.z);
  scene.add(furnaceHeatFill);

  // Volumetric haze sphere — glowing orb inside the furnace opening
  const furnaceGlowOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.FrontSide })
  );
  furnaceGlowOrb.position.set(FURNACE_POS.x, furnaceY + 1.2, FURNACE_POS.z);
  scene.add(furnaceGlowOrb);

  // ── Fire ember particles ──────────────────────────────────────────────────
  const FIRE_COUNT = 80;
  const firePos = new Float32Array(FIRE_COUNT * 3);
  const fireSeed = new Float32Array(FIRE_COUNT);
  const fireLife = new Float32Array(FIRE_COUNT);
  for (let i = 0; i < FIRE_COUNT; i++) {
    fireSeed[i] = Math.random();
    fireLife[i] = Math.random();
  }
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute("position", new THREE.BufferAttribute(firePos, 3));
  const fireMat = new THREE.PointsMaterial({
    color: 0xff8822,
    size: 0.22,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const fireParticles = new THREE.Points(fireGeo, fireMat);
  scene.add(fireParticles);

  // ── Data-stream particles (campfire → depot: "data flowing to Filecoin") ─────
  const STREAM_PARTICLE_COUNT = 40;
  const depotEnd = new THREE.Vector3(STORAGE_POS.x, ty + 2, STORAGE_POS.z);
  const depotStartPos = new THREE.Vector3(STORAGE_POS.x, ty, STORAGE_POS.z);
  type DataStreamItem = {
    points: { geometry: { attributes: { position: { count: number; array: Float32Array; needsUpdate?: boolean } } }; material: { opacity?: number } };
    phases: number[];
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
  };
  type StorageCarrier = {
    mesh: any;
    mixer: any;
    phase: number;
    direction: number;
    startPos: any;
    endPos: any;
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
    ctx.clearRect(0, 0, 512, 200);

    const grad = ctx.createLinearGradient(0, 0, 512, 200);
    grad.addColorStop(0, "rgba(4,12,24,0.94)");
    grad.addColorStop(1, "rgba(8,20,40,0.92)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 200);

    ctx.textAlign = "center";

    const glow = (color: string, blur: number) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    };
    const noGlow = () => {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    };

    ctx.font = "bold 38px MedievalSharp";
    ctx.fillStyle = "#40aaff";
    glow("rgba(0,144,255,0.9)", 24);
    ctx.fillText("Filecoin Onchain Cloud", 256, 52);
    noGlow();

    ctx.font = "22px MedievalSharp";
    ctx.fillStyle = "#80c8ff";
    glow("rgba(0,144,255,0.7)", 16);
    ctx.fillText(
      `Storage: ${formatTFil(summary.totalStorageCostWei)} tFIL · Revenue: $${formatUsd(summary.totalRevenueUsdCents)}`,
      256,
      105
    );
    noGlow();

    ctx.font = "15px MedievalSharp";
    ctx.fillStyle = "#6090c0";
    glow("rgba(0,144,255,0.5)", 10);
    ctx.fillText(
      `Healthy: ${summary.activeAgents} · At-Risk: ${summary.atRiskAgents} · Wound: ${summary.windDownCount}`,
      256,
      148
    );
    noGlow();

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
    // NPC wander state
    wanderTarget: { x: number; z: number } | null;
    wanderTimer: number;
    wanderState: "idle" | "walking";
    homeX: number;
    homeZ: number;
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
  // Idle-suitable animations to randomly play when agents stop moving
  const IDLE_ANIM_NAMES = ["Idle", "Wave", "ThumbsUp", "Dance", "Yes", "No", "Standing", "Punch"];
  const idleAnims = IDLE_ANIM_NAMES
    .map((name) => gltf.animations?.find((a: { name: string }) => a.name === name))
    .filter(Boolean) as { name: string }[];
  const pickRandomIdleAnim = () => idleAnims[Math.floor(Math.random() * idleAnims.length)] ?? idleClip;

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
    const displayName = row.name || cfg.displayName;

    const isActive = row.economy.status === "healthy";
    const colors: { primary: number; glow: number } = (isActive ? AGENT_COLORS_ACTIVE : AGENT_COLORS_INACTIVE)[cfg.type as keyof typeof AGENT_COLORS_ACTIVE] ?? AGENT_COLORS_ACTIVE.Worker;
    const clipToPlay = isActive ? pickRandomIdleAnim() : sittingClip;

    const clone = gltf.scene.clone(true);
    clone.scale.setScalar(isActive ? 0.7 : 0.4);
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
            mat.emissiveIntensity = isEye ? 1.5 : isActive ? 0.8 : 0;
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
    const agentLight = new THREE.PointLight(colors.glow, isActive ? 1.5 : 0, 5);
    agentLight.position.set(0, 1.2, 0);
    g.add(agentLight);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 8, 32),
      new THREE.MeshStandardMaterial({
        color: colors.glow,
        emissive: colors.glow,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.85,
      })
    );
    halo.position.y = 1.8;
    halo.rotation.x = Math.PI / 2;
    halo.name = "agentHalo";
    halo.visible = isActive;
    g.add(halo);
    const lc = document.createElement("canvas");
    lc.width = 256;
    lc.height = 64;
    const ctx = lc.getContext("2d")!;
    ctx.font = "bold 28px MedievalSharp";
    ctx.fillStyle = isActive ? "#ffffff" : "#555555";
    ctx.textAlign = "center";
    ctx.fillText(displayName, 128, 30);
    ctx.font = "16px MedievalSharp";
    ctx.fillStyle = isActive ? "#a89060" : "#3a3a3a";
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
    // Healthy agent glow — emerald ring hovering above head
    const healthGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.65, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    healthGlow.position.y = 2.6;
    healthGlow.visible = row.economy.status === "healthy";
    g.add(healthGlow);
    g.position.set(x, y, z);
    g.userData = { creature: { id: row.agentId, row, cfg }, healthGlow, agentLight, halo };
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
      wanderTarget: null,
      wanderTimer: Math.random() * 3, // stagger initial wander
      wanderState: "idle" as const,
      homeX: x,
      homeZ: z,
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
    const furnaceHits = ray.intersectObject(furnaceGroup, true);
    if (furnaceHits.length > 0) {
      onFurnaceClick();
      return;
    }
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

  // ── Explorer Robot — roams the terrain, visits the castle randomly ──────────
  const explorerScene = gltf.scene.clone(true);
  explorerScene.scale.setScalar(0.85);
  explorerScene.traverse((obj: any) => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
  const explorerGroup = new THREE.Group();
  explorerGroup.add(explorerScene);
  const explorerStartX = -8;
  const explorerStartZ = 2;
  explorerGroup.position.set(explorerStartX, H(explorerStartX, explorerStartZ), explorerStartZ);
  scene.add(explorerGroup);

  // Soft white glow follows the explorer
  const explorerLight = new THREE.PointLight(0xfff0d0, 1.2, 6);
  explorerLight.position.set(explorerStartX, H(explorerStartX, explorerStartZ) + 1.5, explorerStartZ);
  scene.add(explorerLight);

  const explorerMixer = new THREE.AnimationMixer(explorerScene);
  const explorerWalkClip = gltf.animations?.find((a: any) => a.name === "Walking") ?? null;
  let explorerAction: any = null;
  if (explorerWalkClip) {
    // Start walking immediately
    explorerAction = explorerMixer.clipAction(explorerWalkClip);
    explorerAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }

  // State machine
  const explorer = {
    x: explorerStartX,
    z: explorerStartZ,
    facing: 0,
    state: "walking" as "idle" | "walking",
    target: null as { x: number; z: number; isCastle: boolean } | null,
    timer: 0,
  };

  function pickExplorerTarget(): { x: number; z: number; isCastle: boolean } {
    // 25% chance to head to the castle
    if (Math.random() < 0.25) {
      return {
        x: STORAGE_POS.x + (Math.random() - 0.5) * 5,
        z: STORAGE_POS.z + (Math.random() - 0.5) * 5,
        isCastle: true,
      };
    }
    const bound = WORLD_SIZE * 0.38;
    return {
      x: (Math.random() - 0.5) * 2 * bound,
      z: (Math.random() - 0.5) * 2 * bound,
      isCastle: false,
    };
  }

  // Give an initial target so it starts moving right away
  explorer.target = pickExplorerTarget();

  // Game loop
  let lt = performance.now();
  function loop() {
    const now = performance.now();
    const dt = Math.min((now - lt) / 1000, 0.05);
    lt = now;
    processKeys(dt);
    updateCamera();
    const NPC_SPEED = 5.0;
    const ARRIVE_DIST = 0.8;
    agentCreatures.forEach((c) => {
      const currentRow = dataRef.current.agentRows.find((r) => r.agentId === c.id);
      const isHealthy = currentRow?.economy.status === "healthy";

      // Only healthy agents wander; non-healthy sit at fireplace with no movement
      if (isHealthy) {
        c.wanderTimer -= dt;
        if (c.wanderState === "idle" && c.wanderTimer <= 0) {
          // Pick a fully random target anywhere on the map
          const bound = WORLD_SIZE * 0.30;
          c.wanderTarget = {
            x: (Math.random() - 0.5) * 2 * bound,
            z: (Math.random() - 0.5) * 2 * bound,
          };
          c.wanderState = "walking";
          // Switch to walk animation
          if (c.walkClip) {
            c.activeMixerAction = fadeToAction(c.mixer, c.activeMixerAction, c.walkClip, 0.3);
          }
        } else if (c.wanderState === "walking" && c.wanderTarget) {
          const dx = c.wanderTarget.x - c.x;
          const dz = c.wanderTarget.z - c.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < ARRIVE_DIST) {
            // Arrived — switch to idle, wait before next wander
            c.wanderTarget = null;
            c.wanderState = "idle";
            c.wanderTimer = 1 + Math.random() * 3;
            const randomIdle = pickRandomIdleAnim();
            if (randomIdle) {
              c.activeMixerAction = fadeToAction(c.mixer, c.activeMixerAction, randomIdle, 0.3);
            }
          } else {
            // Move towards target
            const nx = dx / dist;
            const nz = dz / dist;
            c.x += nx * NPC_SPEED * dt;
            c.z += nz * NPC_SPEED * dt;
            c.y = H(c.x, c.z);
            c.facing = Math.atan2(nx, nz);
          }
        }
      } else {
        // Non-healthy: stay at fireplace, no movement
        c.wanderTarget = null;
        c.wanderState = "idle";
        c.x = c.homeX;
        c.z = c.homeZ;
        c.y = H(c.homeX, c.homeZ);
      }

      c.mesh.position.x = c.x;
      c.mesh.position.y = c.y;
      c.mesh.position.z = c.z;
      c.mesh.rotation.y = c.facing;
      // Only update animation for healthy/running agents; non-running stay frozen at fireplace
      if (c.mixer && isHealthy) c.mixer.update(dt);
      const ud = (c.mesh as { userData?: { healthGlow?: { visible: boolean; material?: { opacity: number } }; agentLight?: { intensity: number }; halo?: { visible: boolean; rotation: { z: number } } } }).userData;
      if (ud?.healthGlow && currentRow) {
        ud.healthGlow.visible = isHealthy;
        if (ud.healthGlow.visible && ud.healthGlow.material) {
          ud.healthGlow.material.opacity = 0.4 + Math.sin(now * 0.003 + c.x) * 0.3;
        }
      }
      if (ud?.agentLight) ud.agentLight.intensity = isHealthy ? 1.5 : 0;
      if (ud?.halo) {
        ud.halo.visible = isHealthy;
        if (ud.halo.visible) ud.halo.rotation.z += dt * 1.2;
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
      const ud = cf.userData as { fireLight?: { intensity: number }; fireParticles?: { geometry: { attributes: { position: { count: number; array: Float32Array | null; needsUpdate?: boolean } } }; material: { opacity?: number } } };
      if (ud.fireLight) ud.fireLight.intensity = 1.5 + Math.sin(now * 0.01) * 0.5 + Math.random() * 0.3;
      if (ud.fireParticles) {
        const fp = ud.fireParticles.geometry.attributes.position;
        if (fp?.array) {
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
    const sceneUd = scene.userData as { particles?: { geometry: { attributes: { position: { count: number; array: Float32Array | null; needsUpdate?: boolean } } }; material: { opacity?: number } }; pVel?: { x: number; y: number; z: number }[] };
    if (sceneUd.particles && sceneUd.pVel) {
      const pp = sceneUd.particles.geometry.attributes.position;
      if (pp?.array) {
        for (let i = 0; i < sceneUd.pVel.length; i++) {
          pp.array[i * 3] += sceneUd.pVel[i].x;
          pp.array[i * 3 + 1] += sceneUd.pVel[i].y + Math.sin(now * 0.001 + i) * 0.002;
          pp.array[i * 3 + 2] += sceneUd.pVel[i].z;
          if (pp.array[i * 3 + 1] > 9 || pp.array[i * 3 + 1] < 1) sceneUd.pVel[i].y *= -1;
          if (pp.array[i * 3] > WORLD_SIZE * 0.42 || pp.array[i * 3] < -WORLD_SIZE * 0.42) sceneUd.pVel[i].x *= -1;
          if (pp.array[i * 3 + 2] > WORLD_SIZE * 0.42 || pp.array[i * 3 + 2] < -WORLD_SIZE * 0.42) sceneUd.pVel[i].z *= -1;
        }
        pp.needsUpdate = true;
      }
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

    // Furnace: ring pulse + multi-frequency light flicker + emissive glow + ember particles
    const fireFlicker1 = Math.sin(now * 0.007) * 0.5 + Math.sin(now * 0.019) * 0.3 + Math.sin(now * 0.043) * 0.2;
    const fireFlicker2 = Math.sin(now * 0.011) * 0.4 + Math.sin(now * 0.031) * 0.35 + Math.sin(now * 0.057) * 0.25;
    furnaceRing.material.opacity = 0.4 + fireFlicker1 * 0.2;
    furnaceHeatDisc.material.opacity = 0.2 + Math.abs(fireFlicker2) * 0.18;
    furnaceRing.rotation.y = now * 0.0006;
    furnaceLight.intensity = 10 + fireFlicker1 * 4;
    furnaceFireCore.intensity = 18 + fireFlicker2 * 8;
    furnaceHeatFill.intensity = 4 + Math.abs(fireFlicker1) * 2;
    // Glow orb pulse — throbs with fire
    const orbScale = 0.9 + fireFlicker1 * 0.2 + Math.abs(fireFlicker2) * 0.15;
    furnaceGlowOrb.scale.setScalar(orbScale);
    (furnaceGlowOrb.material as any).opacity = 0.25 + Math.abs(fireFlicker1) * 0.2;
    // Emissive pulse — deep, aggressive glow
    const emissivePulse = 2.0 + fireFlicker1 * 0.8 + Math.abs(fireFlicker2) * 0.6;
    furnaceMaterials.forEach((mat: any) => { mat.emissiveIntensity = emissivePulse; });
    // Ember particles — rise, drift, fade out and respawn
    const furnaceTopY = furnaceY + TARGET_FURNACE_HEIGHT * 0.75;
    for (let i = 0; i < FIRE_COUNT; i++) {
      fireLife[i] += dt * (0.5 + fireSeed[i] * 0.5);
      if (fireLife[i] > 1) { fireLife[i] = 0; fireSeed[i] = Math.random(); }
      const t = fireLife[i];
      const angle = fireSeed[i] * Math.PI * 2 + now * 0.001 * (i % 3 === 0 ? 1 : -1);
      const radius = (0.05 + fireSeed[i] * 0.4) * (1 - t * 0.6);
      firePos[i * 3]     = FURNACE_POS.x + Math.cos(angle) * radius;
      firePos[i * 3 + 1] = furnaceTopY + t * (2.5 + fireSeed[i] * 1.5);
      firePos[i * 3 + 2] = FURNACE_POS.z + Math.sin(angle) * radius;
    }
    const firePosAttr = fireGeo.attributes.position;
    if (firePosAttr) firePosAttr.needsUpdate = true;
    // Ember color shifts orange → yellow → fade
    const emberHeat = 0.5 + Math.sin(now * 0.008) * 0.3;
    fireMat.color.setRGB(1, 0.35 + emberHeat * 0.5, 0.02);
    fireMat.opacity = 0.75 + emberHeat * 0.2;

    // ── Explorer robot update ────────────────────────────────────────────────
    const EXPLORER_SPEED = 5.5;
    const EXPLORER_ARRIVE = 0.9;
    if (explorer.state === "idle") {
      explorer.timer -= dt;
      if (explorer.timer <= 0) {
        explorer.target = pickExplorerTarget();
        explorer.state = "walking";
        explorerAction = fadeToAction(explorerMixer, explorerAction, explorerWalkClip, 0.25);
      }
    } else if (explorer.state === "walking" && explorer.target) {
      const edx = explorer.target.x - explorer.x;
      const edz = explorer.target.z - explorer.z;
      const edist = Math.sqrt(edx * edx + edz * edz);
      if (edist < EXPLORER_ARRIVE) {
        explorer.state = "idle";
        // Castle visits are longer; random roam stops are shorter
        explorer.timer = explorer.target.isCastle
          ? 6 + Math.random() * 10
          : 1.5 + Math.random() * 4;
        explorer.target = null;
        const idleAnim = pickRandomIdleAnim();
        explorerAction = fadeToAction(explorerMixer, explorerAction, idleAnim, 0.3);
      } else {
        const enx = edx / edist;
        const enz = edz / edist;
        explorer.x += enx * EXPLORER_SPEED * dt;
        explorer.z += enz * EXPLORER_SPEED * dt;
        explorer.facing = Math.atan2(enx, enz);
      }
    }
    explorerGroup.position.set(explorer.x, H(explorer.x, explorer.z), explorer.z);
    explorerGroup.rotation.y = explorer.facing;
    explorerLight.position.set(explorer.x, H(explorer.x, explorer.z) + 1.8, explorer.z);
    explorerMixer.update(dt);

    // Filecoin model: hover bob + spin + blue glow pulse
    filecoinGroup.rotation.y += dt * 1.2;
    filecoinGroup.position.y = ty + filHoverBaseY + Math.sin(now * 0.002) * 0.5;
    const filPulse = 0.9 + Math.sin(now * 0.003) * 0.25 + Math.sin(now * 0.0071) * 0.12;
    filecoinMaterials.forEach((mat: any) => { mat.emissiveIntensity = filPulse; });
    filGlowCore.intensity = 2.5 + Math.sin(now * 0.003) * 0.8;
    filGlowCore.position.y = ty + filHoverBaseY + Math.sin(now * 0.002) * 0.5;
    filGlowWide.intensity = 1.2 + Math.sin(now * 0.002 + 1) * 0.4;
    filGlowWide.position.y = ty + filHoverBaseY + Math.sin(now * 0.002) * 0.5 - 1;

    // Filecoin Onchain Cloud card: slow spin + gentle hover + glow pulse
    statusCardGroup.rotation.y += dt * 0.6;
    statusCardGroup.position.y = ty + statusCardBaseY + Math.sin(now * 0.0015 + 1) * 0.35;
    const cardPulse = 0.9 + Math.sin(now * 0.004) * 0.4;
    statusCardMat.emissiveIntensity = 0.5 + cardPulse * 0.4;
    cardGlowCore.intensity = 3.5 + Math.sin(now * 0.003) * 1.2;
    cardGlowWide.intensity = 2 + Math.sin(now * 0.002 + 0.5) * 0.8;

    // Update status card & economy board textures periodically
    if (Math.floor(now / 2000) !== Math.floor((now - dt * 1000) / 2000)) {
      renderStatusCard();
      statusCardTex.needsUpdate = true;
      renderEconBoard();
      econBoardTex.needsUpdate = true;
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
