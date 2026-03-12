/**
 * GET /api/economy?agentIds=1,2,3
 * GET /api/economy?network=filecoinCalibration
 *
 * Returns fresh economy data for the given agent IDs, or all agents on a network.
 * When no agentIds: fetches all agents from the registry for the network.
 * Names: uses metadata.name from registry when available, else "Agent #id".
 */

import { NextResponse } from "next/server";
import { getAgentsPage } from "@/lib/agents";
import {
  fetchEconomyAccounts,
  fetchEconomyEvents,
  computeEconomySummary,
} from "@/lib/economy";
import { fetchRecentSEOReports, fetchRecentInvestorReports, fetchRecentCompetitorReports } from "@/lib/agent-reports";
import type { NetworkId } from "@/lib/networks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentIdsParam = url.searchParams.get("agentIds");
  const networkParam = (url.searchParams.get("network") as NetworkId) || "filecoinCalibration";

  let agentIds: string[];
  const nameByAgentId: Record<string, string> = {};

  if (agentIdsParam) {
    agentIds = agentIdsParam.split(",").filter(Boolean);
    agentIds.forEach((id) => {
      nameByAgentId[id] = `Agent #${id}`;
    });
  } else {
    const result = await getAgentsPage({
      network: networkParam,
      pageSize: 100,
    }).catch(() => ({ items: [] }));
    agentIds = result.items.map((a) => a.agentId);
    result.items.forEach((a) => {
      nameByAgentId[a.agentId] = a.metadata?.name?.trim() || `Agent #${a.agentId}`;
    });
  }

  const [accounts, events, seoReports, investorReports, competitorReports] = await Promise.all([
    fetchEconomyAccounts(agentIds).catch(() => new Map()),
    fetchEconomyEvents(20).catch(() => []),
    fetchRecentSEOReports(50).catch(() => []),
    fetchRecentInvestorReports(50).catch(() => []),
    fetchRecentCompetitorReports(50).catch(() => []),
  ]);

  const runCounts: Record<string, number> = {
    "12": seoReports.length,
    "13": investorReports.length,
    "14": competitorReports.length,
  };

  const summary = computeEconomySummary(accounts);

  const agentRows = agentIds.map((id) => ({
    agentId: id,
    networkId: networkParam,
    name: nameByAgentId[id] ?? `Agent #${id}`,
    economy: accounts.get(id) ?? {
      agentId: id,
      balance: "0",
      totalSpent: "0",
      totalEarned: "0",
      lastActivity: 0,
      windDown: false,
      status: "healthy" as const,
    },
    completedRuns: runCounts[id] ?? 0,
  }));

  return NextResponse.json({
    summary,
    agentRows,
    events,
    fetchedAt: new Date().toISOString(),
  });
}
