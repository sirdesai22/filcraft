/**
 * /economy — Agent Economy Dashboard (server component)
 *
 * Fetches initial on-chain data from AgentEconomyRegistry and renders
 * the economy dashboard. The client component refreshes data every 30s.
 */

import { Suspense } from "react";
import Link from "next/link";
import { EconomyClient } from "./economy-client";
import { getAgentsPage } from "@/lib/agents";
import {
  fetchEconomyAccounts,
  fetchEconomyEvents,
  computeEconomySummary,
} from "@/lib/economy";

// Agent run count endpoints (keyed by filecoinCalibration agentId)
const AGENT_RUN_ENDPOINTS: Record<string, string> = {
  "12": process.env.SEO_AGENT_URL
    ? `${process.env.SEO_AGENT_URL}/api/debug/reports`
    : "https://seo-agent-rouge-five.vercel.app/api/debug/reports",
  "13": process.env.INVESTOR_FINDER_URL_PUBLIC
    ? `${process.env.INVESTOR_FINDER_URL_PUBLIC}/api/debug/reports`
    : "https://investor-finder-three.vercel.app/api/debug/reports",
  "14": process.env.COMPETITOR_ANALYSER_URL
    ? `${process.env.COMPETITOR_ANALYSER_URL}/api/debug/reports`
    : "https://competitor-analyser.vercel.app/api/debug/reports",
};

async function fetchRunCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await Promise.allSettled(
    Object.entries(AGENT_RUN_ENDPOINTS).map(async ([agentId, url]) => {
      try {
        const res = await fetch(url, { next: { revalidate: 60 } });
        if (!res.ok) return;
        const data = await res.json() as { reports?: Array<{ status: string }> };
        counts[agentId] = (data.reports ?? []).filter((r) => r.status === "completed").length;
      } catch { /* silent */ }
    })
  );
  return counts;
}

export const dynamic = "force-dynamic";

export default async function EconomyPage() {
  // Fetch all agents on Filecoin Calibration to get their IDs
  const agentsResult = await getAgentsPage({
    network: "filecoinCalibration",
    pageSize: 100,
  }).catch(() => ({ items: [], total: 0, page: 1, hasMore: false }));

  const agentIds = agentsResult.items.map((a) => a.agentId);

  // Fetch economy data for all known agents
  const [accounts, events, runCounts] = await Promise.all([
    fetchEconomyAccounts(agentIds).catch(() => new Map()),
    fetchEconomyEvents(20).catch(() => []),
    fetchRunCounts(),
  ]);

  const summary = computeEconomySummary(accounts);

  // Build agent rows for the P&L table
  const agentRows = agentsResult.items.map((agent) => {
    const acct = accounts.get(agent.agentId) ?? {
      agentId: agent.agentId,
      balance: "0",
      totalSpent: "0",
      totalEarned: "0",
      lastActivity: 0,
      windDown: false,
      status: "healthy" as const,
    };
    return {
      agentId: agent.agentId,
      networkId: agent.networkId,
      name: agent.metadata?.name ?? `Agent #${agent.agentId}`,
      economy: acct,
      completedRuns: runCounts[agent.agentId] ?? 0,
    };
  });

  const initialData = {
    summary,
    agentRows,
    events,
    fetchedAt: new Date().toISOString(),
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Agent Economy</h1>
          <p className="text-muted-foreground">
            Live accounting: storage costs, revenue, survival rates, and wind-downs
            for the RFS-4 autonomous agent economy testbed on Filecoin Calibration.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          View in World →
        </Link>
      </div>

      <Suspense fallback={<EconomySkeleton />}>
        <EconomyClient initialData={initialData} agentIds={agentIds} />
      </Suspense>
    </div>
  );
}

function EconomySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 rounded-xl bg-muted" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
