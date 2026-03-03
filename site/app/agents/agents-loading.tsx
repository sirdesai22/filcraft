"use client";

import { WorkspaceLayout } from "@/components/workspace-layout";
import { RegistryAgentFilterSidebar } from "@/components/filter-sidebar";
import { AgentCardSkeleton } from "@/components/agent-card-skeleton";
import { NETWORKS, NETWORK_IDS } from "@/lib/networks";

const NETWORK_OPTIONS = NETWORK_IDS.map((id) => ({
  id,
  name: NETWORKS[id].name,
}));

/**
 * Skeleton loading state matching the agents page layout.
 * Keeps layout stable during load (like erc-8004-agents-explorer-demo).
 */
export function AgentsPageLoading() {
  return (
    <WorkspaceLayout
      sidebar={
        <RegistryAgentFilterSidebar
          protocol="all"
          onProtocolChange={() => {}}
          searchQuery=""
          onSearchChange={() => {}}
          network="baseSepolia"
          onNetworkChange={() => {}}
          networks={NETWORK_OPTIONS}
        />
      }
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
            <div className="h-4 w-72 rounded bg-muted animate-pulse" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
