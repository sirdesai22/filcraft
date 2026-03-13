"use client";

import { useQuery } from "@tanstack/react-query";
import type { DataListing } from "@/lib/data-marketplace";

interface DataListingsResponse {
  listings: DataListing[];
  total: number;
}

export function useAgentArtifacts(agentId: string | number) {
  return useQuery({
    queryKey: ["data-listings", "agent", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/data-listings?agentId=${agentId}`);
      if (!res.ok) throw new Error("Failed to fetch artifacts");
      return res.json() as Promise<DataListingsResponse>;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
