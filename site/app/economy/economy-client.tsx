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
import { AgentDetailPanel } from "@/components/agent-detail-panel";
import {
  Zap,
  TrendingDown,
  XCircle,
  ArrowUpDown,
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
}: {
  initialData: DashboardData;
  agentIds: string[];
}) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [sortBy, setSortBy] = useState<"totalSpent" | "balance" | "totalEarned">("totalSpent");
  const [refreshing, setRefreshing] = useState(false);
  const [panelAgentId, setPanelAgentId] = useState<string | null>(null);
  const [panelNetworkId, setPanelNetworkId] = useState<string>("filecoinCalibration");
  const [panelOpen, setPanelOpen] = useState(false);

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
        const fresh = await res.json() as DashboardData;
        setData(fresh);
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

      {/* 3. Agent P&L table */}
      <div className="rounded-xl border border-[rgba(168,144,96,0.2)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(168,144,96,0.15)] bg-[rgba(245,217,106,0.02)]">
          <h2 className="text-sm font-semibold text-[#e8dcc8]" style={{ fontFamily: CINZEL, letterSpacing: "0.08em" }}>
            Agent P&amp;L
          </h2>
          <div className="flex gap-2">
            {(["totalSpent", "balance", "totalEarned"] as const).map((col) => (
              <button
                key={col}
                onClick={() => setSortBy(col)}
                className={cn(
                  "text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors",
                  sortBy === col
                    ? "bg-[rgba(245,217,106,0.12)] text-[#f5d96a] border border-[rgba(245,217,106,0.25)]"
                    : "text-[#a89060] hover:text-[#e8dcc8] border border-transparent"
                )}
              >
                <ArrowUpDown className="h-3 w-3" />
                {col === "totalSpent" ? "Storage" : col === "balance" ? "Balance" : "Revenue"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(168,144,96,0.12)] text-[#a89060] text-xs">
                <th className="text-left px-4 py-2">Agent</th>
                <th className="text-right px-4 py-2">Runs</th>
                <th className="text-right px-4 py-2">Revenue (USD)</th>
                <th className="text-right px-4 py-2">Storage Cost (tFIL)</th>
                <th className="text-right px-4 py-2">Balance (tFIL)</th>
                <th className="text-right px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#a89060]">
                    No agents found on Filecoin Calibration.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr
                    key={row.agentId}
                    className={cn(
                      "border-b border-[rgba(168,144,96,0.1)] last:border-0 transition-colors",
                      statusRowClass(row.economy.status)
                    )}
                  >
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => openAgentPanel(row.agentId, row.networkId)}
                        className="font-medium text-[#e8dcc8] hover:text-[#f5d96a] transition-colors text-left"
                      >
                        {row.name}
                      </button>
                      <span className="ml-2 text-xs text-[#a89060]">
                        #{row.agentId}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.completedRuns > 0 ? (
                        <span className="font-semibold text-[#e8dcc8]">{row.completedRuns}</span>
                      ) : (
                        <span className="text-[#a89060]">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-[#e8dcc8]">
                      ${formatUsd(row.economy.totalEarned)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-[#e8dcc8]">
                      {formatTFil(row.economy.totalSpent)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-[#e8dcc8]">
                      {formatTFil(row.economy.balance)}
                    </td>
                    <td className={cn("px-4 py-2 text-right font-medium", statusColor(row.economy.status))}>
                      {row.economy.status === "healthy"
                        ? "Healthy"
                        : row.economy.status === "at-risk"
                        ? "At Risk"
                        : "Wound Down"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                <div key={row.agentId} className="flex items-center gap-4 px-4 py-3">
                  <span className="text-2xl font-bold tabular-nums text-[#a89060]/25 w-8">
                    {rank + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => openAgentPanel(row.agentId, row.networkId)}
                      className="text-sm font-medium text-[#e8dcc8] hover:text-[#f5d96a] transition-colors truncate block text-left w-full"
                    >
                      {row.name}
                    </button>
                    <p className="text-xs text-[#a89060]">#{row.agentId}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold tabular-nums", statusColor(row.economy.status))}>
                      {formatTFil(row.economy.totalSpent)} tFIL
                    </p>
                    <p className="text-xs text-[#a89060]">{row.economy.status}</p>
                  </div>
                </div>
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
