"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { RegistryAgentFilterSidebar } from "@/components/filter-sidebar";
import { RegistryAgentCard } from "@/components/agent-card";
import { AgentCardSkeleton } from "@/components/agent-card-skeleton";
import { Button } from "@/components/ui/button";
import type { RegistryAgent } from "@/lib/registry";
import type { GetAgentsPageResult } from "@/lib/agents";
import { NETWORKS, NETWORK_IDS, type NetworkId } from "@/lib/networks";

const PAGE_SIZE = 12;
const NETWORK_OPTIONS = NETWORK_IDS.map((id) => ({
  id,
  name: NETWORKS[id].name,
}));

interface AgentsPageClientProps {
  initialData: GetAgentsPageResult;
  initialNetwork: NetworkId;
}

export function AgentsPageClient({
  initialData,
  initialNetwork,
}: AgentsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<RegistryAgent[]>(initialData.items);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkId>(initialNetwork);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [total, setTotal] = useState(initialData.total);

  const fetchAgents = useCallback(
    async (page: number, net: NetworkId) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: PAGE_SIZE.toString(),
          network: net,
        });
        // Filecoin Calibration: bypass cache (GLIF RPC lookback can cause stale empty cache)
        if (net === "filecoinCalibration") params.set("noCache", "1");

        const res = await fetch(`/api/agents?${params}`);
        const data = await res.json();

        if (data.success) {
          setAgents(data.items);
          setCurrentPage(page);
          setHasMore(data.hasMore);
          setTotal(data.total);
        } else {
          setError(data.error ?? "Failed to fetch agents");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleNetworkChange = useCallback(
    (net: string) => {
      const n = net as NetworkId;
      setNetwork(n);
      const next = new URLSearchParams(searchParams.toString());
      next.set("network", n);
      router.push(`/agents?${next.toString()}`, { scroll: false });
      fetchAgents(1, n);
    },
    [searchParams, router, fetchAgents]
  );

  // Sync network from URL when navigating back/forward
  useEffect(() => {
    const urlNet = searchParams.get("network") as NetworkId | null;
    if (urlNet && NETWORK_IDS.includes(urlNet) && urlNet !== network) {
      setNetwork(urlNet);
      fetchAgents(1, urlNet);
    }
  }, [searchParams]);

  const showSkeleton = isLoading;
  const showContent = !isLoading && !error;
  const displayedAgents = agents;

  return (
    <WorkspaceLayout
      sidebar={
        <RegistryAgentFilterSidebar
          network={network}
          onNetworkChange={handleNetworkChange}
          networks={NETWORK_OPTIONS}
        />
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl"
              style={{ fontFamily: "var(--font-playfair-display), serif" }}
            >
              Agent Registry
            </h1>
            <p className="mt-1 text-muted-foreground">
              On-chain agents registered via ERC-8004 on {NETWORKS[network].name}.
              {!isLoading && total > 0 && (
                <span className="ml-1 font-medium text-foreground">
                  {total} agent{total !== 1 ? "s" : ""} found.
                </span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchAgents(currentPage, network)}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 py-16 text-center"
            >
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => fetchAgents(currentPage, network)}
              >
                Retry
              </Button>
            </motion.div>
          ) : showSkeleton ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </motion.div>
          ) : displayedAgents.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center"
            >
              <p className="text-muted-foreground">No agents found.</p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              layout
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.05 } },
                hidden: {},
              }}
            >
              <AnimatePresence mode="popLayout">
                {displayedAgents.map((agent) => (
                  <motion.div
                    key={agent.id}
                    layout
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <RegistryAgentCard agent={agent} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {showContent && displayedAgents.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} · {displayedAgents.length} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1 || isLoading}
                onClick={() => fetchAgents(currentPage - 1, network)}
              >
                ← Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore || isLoading}
                onClick={() => fetchAgents(currentPage + 1, network)}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}
