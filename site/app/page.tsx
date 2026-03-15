import { AetheriaWorld } from "@/app/world/AetheriaWorld";
import { SplashGate } from "@/components/SplashGate";
import { getAgentsPage } from "@/lib/agents";
import {
  fetchEconomyAccounts,
  fetchEconomyEvents,
  computeEconomySummary,
} from "@/lib/economy";
import {
  fetchRecentSEOReports,
  fetchRecentInvestorReports,
  fetchRecentCompetitorReports,
} from "@/lib/agent-reports";

const NETWORK = "filecoinCalibration" as const;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const registryResult = await getAgentsPage({
    network: NETWORK,
    pageSize: 100,
  }).catch(() => ({ items: [] }));

  const agentIds = registryResult.items.map((a) => a.agentId);

  const [economyAccounts, events, seoReports, investorReports, competitorReports] =
    await Promise.all([
      fetchEconomyAccounts(agentIds).catch(() => new Map()),
      fetchEconomyEvents(20).catch(() => []),
      fetchRecentSEOReports(50).catch(() => []),
      fetchRecentInvestorReports(50).catch(() => []),
      fetchRecentCompetitorReports(50).catch(() => []),
    ]);

  const summary = computeEconomySummary(economyAccounts);

  const runCounts: Record<string, number> = {
    "12": seoReports.length,
    "13": investorReports.length,
    "14": competitorReports.length,
  };

  const agentRows = agentIds.map((id) => {
    const reg = registryResult.items.find((a) => a.agentId === id);
    return {
      agentId: id,
      networkId: NETWORK,
      name: reg?.metadata?.name?.trim() || `Agent #${id}`,
      economy: economyAccounts.get(id) ?? {
        agentId: id,
        balance: "0",
        totalSpent: "0",
        totalEarned: "0",
        lastActivity: 0,
        windDown: false,
        status: "healthy" as const,
      },
      completedRuns: runCounts[id] ?? 0,
    };
  });

  const initialData = {
    summary,
    agentRows,
    events,
    fetchedAt: new Date().toISOString(),
  };

  return (
    <SplashGate>
      <main className="min-h-screen w-full overflow-hidden">
        <AetheriaWorld initialData={initialData} />
      </main>
    </SplashGate>
  );
}
