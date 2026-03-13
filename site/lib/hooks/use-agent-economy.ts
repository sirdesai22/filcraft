"use client";

import { useQuery } from "@tanstack/react-query";

interface EconomyResponse {
  agentRows?: Array<{
    agentId: string;
    economy: {
      balance: string;
      totalSpent: string;
      totalEarned: string;
      status: string;
      windDown: boolean;
    };
  }>;
}

export function useAgentEconomy(agentId: string | number, network = "filecoinCalibration") {
  return useQuery({
    queryKey: ["economy", agentId, network],
    queryFn: async () => {
      const res = await fetch(`/api/economy?agentIds=${agentId}&network=${network}`);
      if (!res.ok) throw new Error("Failed to fetch economy");
      return res.json() as Promise<EconomyResponse>;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
