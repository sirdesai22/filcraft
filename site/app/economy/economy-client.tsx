"use client";

/**
 * EconomyClient — client-side economy dashboard with 30s auto-refresh.
 *
 * Sections:
 * 1. Live stats bar
 * 2. Survival status cards (Healthy / At-Risk / Wound Down)
 * 3. Agent P&L table
 * 4. Recent activity feed
 * 5. Storage cost leaderboard
 *
 * Clicking an agent opens a side panel with agent details (no page navigation).
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AgentDetailPanel } from "@/components/agent-detail-panel";
import {
  Zap,
  TrendingDown,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Database,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AgentEconomyAccount,
  EconomyEvent,
  EconomySummary,
} from "@/lib/economy";

const CINZEL = "var(--font-cinzel, Cinzel, serif)";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentRow {
  agentId: string;
  networkId: string;
  name: string;
  economy: AgentEconomyAccount;
  completedRuns: number;
  reputation?: { totalFeedback: number; averageScore: number | null };
}

interface DashboardData {
  summary: EconomySummary;
  agentRows: AgentRow[];
  events: EconomyEvent[];
  fetchedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatBigIntWei(wei: string | bigint): string {
  return formatTFil(wei);
}

function formatBigIntCents(cents: string | bigint): string {
  return formatUsd(cents);
}

function agentInitialsSvg(seed: string, name: string): string {
  const PALETTES = [
    ["#1a2744", "#6a8fd8"],
    ["#0f2b1c", "#4caf7a"],
    ["#26133d", "#a87ad4"],
    ["#2e1808", "#d4935a"],
    ["#0f2828", "#4abdb0"],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const [bg, fg] = PALETTES[Math.abs(h) % PALETTES.length];
  const words = name.replace(/^Agent\s*#?\d*\s*/i, "").trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.replace(/\s+/g, "").slice(0, 2).toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
    <rect width="40" height="40" fill="${bg}" rx="8"/>
    <text x="20" y="24" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-size="14" font-weight="bold" fill="${fg}">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function statusColor(status: AgentEconomyAccount["status"]): string {
  switch (status) {
    case "healthy":
      return "text-emerald-400";
    case "at-risk":
      return "text-amber-400";
    case "wound-down":
      return "text-[#a89060]/60";
  }
}

function statusBg(status: AgentEconomyAccount["status"]): string {
  switch (status) {
    case "healthy":
      return "border-emerald-500/20 bg-emerald-500/5";
    case "at-risk":
      return "border-amber-500/20 bg-amber-500/5";
    case "wound-down":
      return "border-[rgba(168,144,96,0.15)] bg-[rgba(168,144,96,0.03)] opacity-60";
  }
}

function statusRowClass(status: AgentEconomyAccount["status"]): string {
  switch (status) {
    case "healthy":
      return "hover:bg-emerald-500/5";
    case "at-risk":
      return "hover:bg-amber-500/5";
    case "wound-down":
      return "opacity-50 hover:bg-[rgba(168,144,96,0.04)]";
  }
}

function eventTypeLabel(type: EconomyEvent["type"]): string {
  switch (type) {
    case "BudgetDeposited":
      return "Budget topped up";
    case "StorageCostRecorded":
      return "Storage cost recorded";
    case "RevenueRecorded":
      return "Revenue recorded";
    case "AgentWindDown":
      return "Agent wound down";
  }
}

function eventIcon(type: EconomyEvent["type"]) {
  switch (type) {
    case "BudgetDeposited":
      return <Zap className="h-4 w-4 text-emerald-400" />;
    case "StorageCostRecorded":
      return <Database className="h-4 w-4 text-blue-400" />;
    case "RevenueRecorded":
      return <DollarSign className="h-4 w-4 text-violet-400" />;
    case "AgentWindDown":
      return <XCircle className="h-4 w-4 text-[#a89060]/60" />;
  }
}

function eventDescription(event: EconomyEvent): string {
  switch (event.type) {
    case "BudgetDeposited":
      return `Agent #${event.agentId} received ${formatTFil(event.data.amount ?? "0")} tFIL`;
    case "StorageCostRecorded":
      return `Agent #${event.agentId} stored artifact — cost ${formatTFil(event.data.costWei ?? "0")} tFIL`;
    case "RevenueRecorded":
      return `Agent #${event.agentId} earned $${formatUsd(event.data.usdCents ?? "0")} USD`;
    case "AgentWindDown":
      return `Agent #${event.agentId} wound down — ${event.data.reason ?? ""}`;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EconomyClient({
  initialData,
  agentIds,
  initialAgent = null,
  initialNetwork = "filecoinCalibration",
}: {
  initialData: DashboardData;
  agentIds: string[];
  initialAgent?: string | null;
  initialNetwork?: string;
}) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [sortBy, setSortBy] = useState<"totalSpent" | "balance" | "totalEarned">("totalSpent");
  const [refreshing, setRefreshing] = useState(false);
  const [panelAgentId, setPanelAgentId] = useState<string | null>(initialAgent);
  const [panelNetworkId, setPanelNetworkId] = useState<string>(initialNetwork);
  const [panelOpen, setPanelOpen] = useState(!!initialAgent);

  const openAgentPanel = useCallback((agentId: string, networkId: string) => {
    setPanelAgentId(agentId);
    setPanelNetworkId(networkId);
    setPanelOpen(true);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/economy?agentIds=${agentIds.join(",")}`);
      if (res.ok) {
        const fresh = (await res.json()) as DashboardData;
        setData((prev) => {
          // Preserve agent names from initial load when refresh returns "Agent #id"
          const nameByAgentId = new Map(prev.agentRows.map((r) => [r.agentId, r.name]));
          const agentRows = fresh.agentRows.map((row) => {
            const existingName = nameByAgentId.get(row.agentId);
            const isFallbackName = row.name === `Agent #${row.agentId}`;
            return {
              ...row,
              name: isFallbackName && existingName ? existingName : row.name,
            };
          });
          return { ...fresh, agentRows };
        });
      }
    } catch {
      // silent — keep stale data
    } finally {
      setRefreshing(false);
    }
  }, [agentIds]);

  useEffect(() => {
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const { summary, agentRows, events } = data;

  const sorted = [...agentRows].sort((a, b) => {
    return Number(BigInt(b.economy[sortBy]) - BigInt(a.economy[sortBy]));
  });

  const leaderboard = [...agentRows]
    .sort((a, b) => Number(BigInt(b.economy.totalSpent) - BigInt(a.economy.totalSpent)))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 1. Live stats bar */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-[rgba(168,144,96,0.2)] bg-[rgba(18,13,6,0.6)] px-6 py-4 text-sm">
        <span>
          <span className="font-semibold text-emerald-400">{summary.activeAgents}</span>{" "}
          <span className="text-[#a89060]">healthy</span>
        </span>
        <span>
          <span className="font-semibold text-amber-400">{summary.atRiskAgents}</span>{" "}
          <span className="text-[#a89060]">at-risk</span>
        </span>
        <span>
          <span className="font-semibold text-[#a89060]/60">{summary.windDownCount}</span>{" "}
          <span className="text-[#a89060]">wound down</span>
        </span>
        <span className="text-[#a89060]/40">·</span>
        <span>
          <span className="font-semibold text-[#e8dcc8]">{formatBigIntWei(summary.totalStorageCostWei)}</span>{" "}
          <span className="text-[#a89060]">tFIL storage spent</span>
        </span>
        <span>
          <span className="font-semibold text-[#e8dcc8]">${formatBigIntCents(summary.totalRevenueUsdCents)}</span>{" "}
          <span className="text-[#a89060]">USDC revenue</span>
        </span>
        <span className="ml-auto flex items-center gap-1 text-[#a89060] text-xs">
          <Clock className="h-3 w-3" />
          {refreshing ? "refreshing…" : `as of ${new Date(data.fetchedAt).toLocaleTimeString()}`}
        </span>
      </div>

      {/* 2. Survival status cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatusCard
          icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
          label="Healthy"
          count={summary.activeAgents}
          description="Balance > 3× minimum"
          className="border-emerald-500/20 bg-emerald-500/5"
        />
        <StatusCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}
          label="At Risk"
          count={summary.atRiskAgents}
          description="Between 1× and 3× minimum"
          className="border-amber-500/20 bg-amber-500/5"
        />
        <StatusCard
          icon={<TrendingDown className="h-5 w-5 text-[#a89060]/60" />}
          label="Wound Down"
          count={summary.windDownCount}
          description="Depleted or manually stopped"
          className="border-[rgba(168,144,96,0.15)] bg-[rgba(168,144,96,0.03)]"
        />
      </div>

      {/* 2b. Status legend */}
      <div className="rounded-xl border border-[rgba(168,144,96,0.15)] bg-[rgba(18,13,6,0.4)] divide-y divide-[rgba(168,144,96,0.1)]">
        <div className="px-5 py-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-[#a89060] uppercase tracking-widest" style={{ fontFamily: CINZEL }}>
            Status Guide
          </span>
        </div>
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[rgba(168,144,96,0.1)]">
          <div className="px-5 py-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-sm font-semibold text-emerald-400">Healthy</span>
            </div>
            <p className="text-xs text-[#a89060] leading-relaxed">
              Balance is above <span className="text-[#e8dcc8]">0.015 tFIL</span> (3× the minimum). The agent is fully operational — it can store reports on Filecoin, earn revenue from x402 payments, and record activity on-chain. A healthy agent will continue running indefinitely as long as its balance stays topped up.
            </p>
          </div>
          <div className="px-5 py-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-sm font-semibold text-amber-400">At Risk</span>
            </div>
            <p className="text-xs text-[#a89060] leading-relaxed">
              Balance is between <span className="text-[#e8dcc8]">0.005</span> and <span className="text-[#e8dcc8]">0.015 tFIL</span>. The agent is still operational but running low on funds. If the balance drops below <span className="text-[#e8dcc8]">0.005 tFIL</span>, anyone on the network can trigger wind-down. Top up immediately to restore healthy status.
            </p>
          </div>
          <div className="px-5 py-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#a89060]/50 shrink-0" />
              <span className="text-sm font-semibold text-[#a89060]/80">Wound Down</span>
            </div>
            <p className="text-xs text-[#a89060] leading-relaxed">
              The agent has been stopped — either its balance fell below <span className="text-[#e8dcc8]">0.005 tFIL</span> and wind-down was triggered by a network participant, or the agent owner shut it down manually. Wound-down is permanent on-chain; the remaining balance (if any) is returned to whoever triggered it.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Agent P&L table */}
      <div className="rounded-xl border border-[rgba(168,144,96,0.2)] overflow-hidden">
        {/* Enhanced header with gradient */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(168,144,96,0.15)] bg-gradient-to-r from-[rgba(245,217,106,0.06)] via-[rgba(245,217,106,0.02)] to-transparent">
          <h2
            className="text-sm font-semibold text-[#e8dcc8]"
            style={{ fontFamily: CINZEL, letterSpacing: "0.08em" }}
          >
            Agent P&amp;L
          </h2>
          <div className="flex gap-1.5">
            {(["totalSpent", "balance", "totalEarned"] as const).map((col) => {
              const isActive = sortBy === col;
              return (
                <button
                  key={col}
                  onClick={() => setSortBy(col)}
                  className={cn(
                    "relative text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-all duration-200",
                    isActive
                      ? "bg-[rgba(245,217,106,0.12)] text-[#f5d96a] border border-[rgba(245,217,106,0.25)]"
                      : "text-[#a89060] hover:text-[#e8dcc8] hover:bg-[rgba(245,217,106,0.04)] border border-transparent"
                  )}
                >
                  {isActive ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  )}
                  {col === "totalSpent" ? "Storage" : col === "balance" ? "Balance" : "Revenue"}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#f5d96a]/50 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid header */}
        <div
          className="grid gap-4 px-5 py-2.5 border-b border-[rgba(168,144,96,0.12)] text-[#a89060] text-xs min-w-[580px]"
          style={{
            gridTemplateColumns: "minmax(140px, 1fr) 60px 90px 100px 100px 100px",
          }}
        >
          <div>Agent</div>
          <div className="text-right">Runs</div>
          <div className="text-right">Revenue (USD)</div>
          <div className="text-right">Storage Cost</div>
          <div className="text-right">Balance</div>
          <div className="text-right">Status</div>
        </div>

        {/* Card-style rows with animations */}
        <div className="overflow-x-auto">
          {sorted.length === 0 ? (
            <div className="px-5 py-12 text-center text-[#a89060] text-sm">
              No agents found on Filecoin Calibration.
            </div>
          ) : (
            <motion.div
              className="divide-y divide-[rgba(168,144,96,0.08)] min-w-[580px]"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: 0.04, delayChildren: 0.02 },
                },
                hidden: {},
              }}
            >
              {sorted.map((row) => {
                  const borderAccent =
                    row.economy.status === "healthy"
                      ? "border-l-emerald-500/60"
                      : row.economy.status === "at-risk"
                        ? "border-l-amber-500/60"
                        : "border-l-[#a89060]/30";
                  return (
                    <motion.div
                      key={row.agentId}
                      layout
                      variants={{
                        visible: { opacity: 1, y: 0 },
                        hidden: { opacity: 0, y: 8 },
                      }}
                      transition={{ duration: 0.25 }}
                      role="button"
                      tabIndex={0}
                      onClick={() => openAgentPanel(row.agentId, row.networkId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openAgentPanel(row.agentId, row.networkId);
                        }
                      }}
                      className={cn(
                        "group grid gap-4 px-5 py-3.5 cursor-pointer transition-all duration-200",
                        "border-l-4",
                        borderAccent,
                        "hover:bg-[rgba(245,217,106,0.03)]",
                        statusRowClass(row.economy.status)
                      )}
                      style={{
                        gridTemplateColumns: "minmax(140px, 1fr) 60px 90px 100px 100px 100px",
                      }}
                    >
                      {/* Agent with avatar */}
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={agentInitialsSvg(row.agentId, row.name)}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-[rgba(168,144,96,0.2)]"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-[#e8dcc8] group-hover:text-[#f5d96a] truncate transition-colors">
                            {row.name}
                          </p>
                          <p className="text-xs text-[#a89060]">#{row.agentId}</p>
                        </div>
                      </div>

                      {/* Runs badge */}
                      <div className="flex items-center justify-end">
                        {row.completedRuns > 0 ? (
                          <span className="inline-flex items-center rounded-md bg-[rgba(245,217,106,0.1)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#f5d96a]">
                            {row.completedRuns}
                          </span>
                        ) : (
                          <span className="text-[#a89060] tabular-nums">0</span>
                        )}
                      </div>

                      {/* Revenue with highlight */}
                      <div className="flex items-center justify-end gap-1.5">
                        {Number(row.economy.totalEarned) > 0 && (
                          <DollarSign className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                        )}
                        <span
                          className={cn(
                            "tabular-nums",
                            Number(row.economy.totalEarned) > 0
                              ? "font-semibold text-violet-400"
                              : "text-[#e8dcc8]"
                          )}
                        >
                          ${formatUsd(row.economy.totalEarned)}
                        </span>
                      </div>

                      {/* Storage cost (gold) */}
                      <div className="flex items-center justify-end tabular-nums text-[#f5d96a]/90">
                        {formatTFil(row.economy.totalSpent)}
                      </div>

                      {/* Balance */}
                      <div className="flex items-center justify-end">
                        <span className="tabular-nums text-[#e8a030]/90 min-w-[3.5rem] text-right">
                          {formatTFil(row.economy.balance)}
                        </span>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center justify-end">
                        <StatusBadge status={row.economy.status} />
                      </div>
                    </motion.div>
                  );
                })}
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 4. Recent activity feed */}
        <div className="rounded-xl border border-[rgba(168,144,96,0.2)]">
          <div className="px-4 py-3 border-b border-[rgba(168,144,96,0.15)] bg-[rgba(245,217,106,0.02)]">
            <h2 className="text-sm font-semibold text-[#e8dcc8]" style={{ fontFamily: CINZEL, letterSpacing: "0.08em" }}>
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-[rgba(168,144,96,0.1)]">
            {events.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#a89060] text-center">
                No events yet — economy contract events appear here once deployed.
              </p>
            ) : (
              events.slice(0, 20).map((ev, i) => (
                <div key={i} className="flex gap-3 px-4 py-3 items-start">
                  <div className="mt-0.5 shrink-0">{eventIcon(ev.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#e8dcc8] leading-snug">
                      {eventDescription(ev)}
                    </p>
                    <p className="text-xs text-[#a89060] mt-0.5 flex items-center gap-2">
                      <span>{eventTypeLabel(ev.type)}</span>
                      {ev.txHash && (
                        <a
                          href={`https://calibration.filscan.io/tx/${ev.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#f5d96a] transition-colors font-mono text-[10px]"
                        >
                          {ev.txHash.slice(0, 10)}…
                        </a>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-[#a89060] shrink-0">
                    #{ev.blockNumber}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 5. Storage cost leaderboard */}
        <div className="rounded-xl border border-[rgba(168,144,96,0.2)]">
          <div className="px-4 py-3 border-b border-[rgba(168,144,96,0.15)] bg-[rgba(245,217,106,0.02)]">
            <h2 className="text-sm font-semibold text-[#e8dcc8]" style={{ fontFamily: CINZEL, letterSpacing: "0.08em" }}>
              Storage Cost Leaderboard
            </h2>
            <p className="text-xs text-[#a89060]">Top 5 agents by cumulative tFIL spent</p>
          </div>
          <div className="divide-y divide-[rgba(168,144,96,0.1)]">
            {leaderboard.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#a89060] text-center">
                No storage activity recorded yet.
              </p>
            ) : (
              leaderboard.map((row, rank) => (
                <button
                  key={row.agentId}
                  type="button"
                  onClick={() => openAgentPanel(row.agentId, row.networkId)}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-[rgba(245,217,106,0.04)] transition-colors cursor-pointer"
                >
                  <span className="text-2xl font-bold tabular-nums text-[#a89060]/25 w-8">
                    {rank + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#e8dcc8] truncate">
                      {row.name}
                    </p>
                    <p className="text-xs text-[#a89060]">#{row.agentId}</p>
                  </div>
                  {row.reputation && row.reputation.totalFeedback > 0 ? (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums text-amber-400">
                        ★ {row.reputation.averageScore?.toFixed(1) ?? "—"}
                      </p>
                      <p className="text-xs text-[#a89060]">{row.reputation.totalFeedback} reviews</p>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-[#a89060]/40">no reviews</p>
                    </div>
                  )}
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-semibold tabular-nums", statusColor(row.economy.status))}>
                      {formatTFil(row.economy.totalSpent)} tFIL
                    </p>
                    <p className="text-xs text-[#a89060]">{row.economy.status}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <AgentDetailPanel
        agentId={panelAgentId}
        networkId={panelNetworkId as "filecoinCalibration"}
        open={panelOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPanelOpen(false);
            setPanelAgentId(null);
          }
        }}
        agentRows={data.agentRows}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusCard({
  icon,
  label,
  count,
  description,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-semibold text-[#e8dcc8]">{label}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums text-[#e8dcc8]">{count}</p>
      <p className="text-xs text-[#a89060] mt-1">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentEconomyAccount["status"] }) {
  const label =
    status === "healthy" ? "Healthy" : status === "at-risk" ? "At Risk" : "Wound Down";
  const dotColor =
    status === "healthy" ? "bg-emerald-400" : status === "at-risk" ? "bg-amber-400" : "bg-[#a89060]/50";
  const pillClass =
    status === "healthy"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : status === "at-risk"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
        : "border-[rgba(168,144,96,0.2)] bg-[rgba(168,144,96,0.05)] text-[#a89060]/70";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        pillClass
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          dotColor,
          status === "healthy" && "animate-pulse"
        )}
      />
      {label}
    </span>
  );
}

