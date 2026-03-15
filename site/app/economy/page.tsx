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
  AGENT_ECONOMY_REGISTRY_ADDRESS,
} from "@/lib/economy";
import { NETWORKS } from "@/lib/networks";

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

  const { identityRegistry, reputationRegistry } = NETWORKS.filecoinCalibration;
  const filscan = (addr: string) =>
    `https://calibration.filscan.io/address/${addr}`;

  const contracts = [
    {
      label: "Identity Registry",
      sublabel: "ERC-8004 agent NFT registry",
      address: identityRegistry,
    },
    {
      label: "Reputation Registry",
      sublabel: "On-chain feedback & scoring",
      address: reputationRegistry,
    },
    {
      label: "Economy Registry",
      sublabel: "Budget, storage cost & revenue",
      address: AGENT_ECONOMY_REGISTRY_ADDRESS,
    },
  ];

  const CINZEL = "var(--font-cinzel, Cinzel, serif)";

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-widest text-[#f5d96a] mb-2" style={{ fontFamily: CINZEL }}>
            Agent Economy
          </h1>
          <p className="text-sm text-[#a89060] max-w-xl leading-relaxed">
            Live accounting: storage costs, revenue, survival rates, and wind-downs
            for the RFS-4 autonomous agent economy testbed on Filecoin Calibration.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-[#f5d96a] hover:text-[#fff8d6] transition-colors"
          style={{ fontFamily: CINZEL, letterSpacing: "0.1em" }}
        >
          View in World →
        </Link>
      </div>

      {/* ── Contract addresses ─────────────────────────────────────────────── */}
      <div className="mb-8 rounded-lg border border-[rgba(168,144,96,0.2)] bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[rgba(168,144,96,0.15)] bg-[rgba(245,217,106,0.03)] flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#a89060]" style={{ fontFamily: CINZEL }}>
            Deployed Contracts · Filecoin Calibration
          </span>
        </div>
        <div className="divide-y divide-[rgba(168,144,96,0.1)]">
          {contracts.map(({ label, sublabel, address }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 hover:bg-[rgba(245,217,106,0.02)] transition-colors">
              <div className="sm:w-52 shrink-0">
                <p className="text-sm font-semibold text-[#e8dcc8]">{label}</p>
                <p className="text-xs text-[#a89060]">{sublabel}</p>
              </div>
              <a
                href={filscan(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[#f5d96a]/70 hover:text-[#f5d96a] transition-colors break-all"
              >
                {address}
              </a>
            </div>
          ))}
        </div>
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
      <div className="h-20 rounded-lg bg-[#1a1208]" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-[#1a1208]" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-[#1a1208]" />
    </div>
  );
}
