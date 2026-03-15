/**
 * GET /api/economy?agentIds=1,2,3
 * GET /api/economy?network=filecoinCalibration
 *
 * Returns fresh economy data for the given agent IDs, or all agents on a network.
 * When no agentIds: fetches all agents from the registry for the network.
 * Names: uses metadata.name from registry when available, else "Agent #id".
 */

import { NextResponse } from "next/server";
import { getAgentsPage, getCachedAgents } from "@/lib/agents";
import {
  fetchEconomyAccounts,
  fetchEconomyEvents,
  computeEconomySummary,
} from "@/lib/economy";
import { fetchRecentSEOReports, fetchRecentInvestorReports, fetchRecentCompetitorReports, fetchRecentBrandReports } from "@/lib/agent-reports";
import { getNetwork } from "@/lib/networks";
import type { NetworkId } from "@/lib/networks";
import { createPublicClient, http, parseAbi } from "viem";
import { filecoinCalibration } from "viem/chains";

const REPUTATION_ABI = parseAbi([
  "function getClients(uint256 agentId) view returns (address[])",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
]);

async function fetchReputationBatch(
  agentIds: string[],
  networkId: NetworkId
): Promise<Record<string, { totalFeedback: number; averageScore: number | null }>> {
  const config = getNetwork(networkId);
  const rpcUrl =
    networkId === "filecoinCalibration"
      ? (process.env.FILECOIN_CALIBRATION_RPC_URL || "https://api.calibration.node.glif.io/rpc/v1")
      : undefined;
  const client = createPublicClient({
    chain: filecoinCalibration,
    transport: http(rpcUrl),
  });

  const results: Record<string, { totalFeedback: number; averageScore: number | null }> = {};

  await Promise.all(
    agentIds.map(async (id) => {
      try {
        const clients = await client.readContract({
          address: config.reputationRegistry,
          abi: REPUTATION_ABI,
          functionName: "getClients",
          args: [BigInt(id)],
        });
        if (!clients.length) {
          results[id] = { totalFeedback: 0, averageScore: null };
          return;
        }
        const [count, summaryValue, summaryValueDecimals] = await client.readContract({
          address: config.reputationRegistry,
          abi: REPUTATION_ABI,
          functionName: "getSummary",
          args: [BigInt(id), clients as `0x${string}`[], "", ""],
        });
        const total = Number(count);
        results[id] = {
          totalFeedback: total,
          averageScore: total > 0 ? Number(summaryValue) / Math.pow(10, summaryValueDecimals) : null,
        };
      } catch {
        results[id] = { totalFeedback: 0, averageScore: null };
      }
    })
  );

  return results;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentIdsParam = url.searchParams.get("agentIds");
  const networkParam = (url.searchParams.get("network") as NetworkId) || "filecoinCalibration";

  let agentIds: string[];
  const nameByAgentId: Record<string, string> = {};

  if (agentIdsParam) {
    agentIds = agentIdsParam.split(",").filter(Boolean);
    // Fetch agent metadata to resolve names (otherwise we'd only have "Agent #id")
    const agents = await getCachedAgents(networkParam).catch(() => []);
    agents.forEach((a) => {
      nameByAgentId[a.agentId] = a.metadata?.name?.trim() || `Agent #${a.agentId}`;
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

  const [accounts, events, seoReports, investorReports, competitorReports, brandReports, reputations] = await Promise.all([
    fetchEconomyAccounts(agentIds).catch(() => new Map()),
    fetchEconomyEvents(20).catch(() => []),
    fetchRecentSEOReports(50).catch(() => []),
    fetchRecentInvestorReports(50).catch(() => []),
    fetchRecentCompetitorReports(50).catch(() => []),
    fetchRecentBrandReports(50).catch(() => []),
    fetchReputationBatch(agentIds, networkParam).catch(() => ({} as Record<string, { totalFeedback: number; averageScore: number | null }>)),
  ]);

  const runCounts: Record<string, number> = {
    "12": seoReports.length,
    "13": investorReports.length,
    "14": competitorReports.length,
    "15": brandReports.length,
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
    reputation: reputations[id] ?? { totalFeedback: 0, averageScore: null },
  }));

  return NextResponse.json({
    summary,
    agentRows,
    events,
    fetchedAt: new Date().toISOString(),
  });
}
