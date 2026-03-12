"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { RegistryAgentFilterSidebar } from "@/components/filter-sidebar";
import { MarketplaceAgentCard } from "@/components/marketplace-agent-card";
import { AgentCardSkeleton } from "@/components/agent-card-skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import type { RegistryAgent } from "@/lib/registry";
import type { GetAgentsPageResult } from "@/lib/agents";
import { NETWORKS, NETWORK_IDS, type NetworkId } from "@/lib/networks";
import { computeCreditScore, type CreditTier } from "@/lib/credit-score";
import { parseAgentCardServices } from "@/lib/agent-validator";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;
const NETWORK_OPTIONS = NETWORK_IDS.map((id) => ({ id, name: NETWORKS[id].name }));

const ALL_TIERS: CreditTier[] = ["new", "bronze", "silver", "gold", "platinum"];
const TIER_LABELS: Record<CreditTier, string> = {
  new: "New",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

interface MarketplaceClientProps {
  initialData: GetAgentsPageResult;
  initialNetwork: NetworkId;
}

export function MarketplaceClient({ initialData, initialNetwork }: MarketplaceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<RegistryAgent[]>(initialData.items);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkId>(initialNetwork);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [total, setTotal] = useState(initialData.total);

  // Client-side filters
  const [tierFilter, setTierFilter] = useState<CreditTier | null>(null);
  const [maxCostUsdc, setMaxCostUsdc] = useState<number>(10);

  const fetchAgents = useCallback(
    async (page: number, net: NetworkId) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: PAGE_SIZE.toString(),
          network: net,
          x402: "true",
        });
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
      router.push(`/marketplace?${next.toString()}`, { scroll: false });
      fetchAgents(1, n);
    },
    [searchParams, router, fetchAgents]
  );

  useEffect(() => {
    const urlNet = searchParams.get("network") as NetworkId | null;
    if (urlNet && NETWORK_IDS.includes(urlNet) && urlNet !== network) {
      setNetwork(urlNet);
      fetchAgents(1, urlNet);
    }
  }, [searchParams]);

  // Client-side filter: tier + cost
  const displayedAgents = useMemo(() => {
    let result = agents;
    if (tierFilter) {
      result = result.filter((a) => computeCreditScore(a).tier === tierFilter);
    }
    if (maxCostUsdc < 10) {
      result = result.filter((a) => {
        if (!a.metadata) return false;
        const parsed = parseAgentCardServices(a.metadata as Parameters<typeof parseAgentCardServices>[0]);
        if (!parsed?.cost) return true;
        const cost = parseFloat(parsed.cost);
        return !isNaN(cost) && cost <= maxCostUsdc;
      });
    }
    return result;
  }, [agents, tierFilter, maxCostUsdc]);

  const showSkeleton = isLoading;
  const showContent = !isLoading && !error;

  const sidebar = (
    <div className="space-y-5">
      <RegistryAgentFilterSidebar
        network={network}
        onNetworkChange={handleNetworkChange}
        networks={NETWORK_OPTIONS}
      />

      <Separator className="opacity-50" />

      <div className="space-y-1.5">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Credit Tier
        </p>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => setTierFilter(null)}
            className={cn(
              "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-all duration-150",
              tierFilter === null
                ? "bg-amber-900/10 font-semibold text-amber-900 dark:bg-amber-100/10 dark:text-amber-200"
                : "font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            All tiers
          </button>
          {ALL_TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(tierFilter === t ? null : t)}
              className={cn(
                "w-full rounded-md px-2.5 py-1.5 text-left text-sm capitalize transition-all duration-150",
                tierFilter === t
                  ? "bg-amber-900/10 font-semibold text-amber-900 dark:bg-amber-100/10 dark:text-amber-200"
                  : "font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {TIER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <Separator className="opacity-50" />

      <div className="space-y-2">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Max Cost
        </p>
        <span className="block px-1 text-xs text-muted-foreground">
          Up to {maxCostUsdc === 10 ? "any" : `${maxCostUsdc.toFixed(2)} USDC`}
        </span>
        <Slider
          value={[maxCostUsdc]}
          onValueChange={(v) => setMaxCostUsdc(v[0])}
          min={0}
          max={10}
          step={0.1}
          className="w-full"
        />
      </div>
    </div>
  );

  return (
    <WorkspaceLayout sidebar={sidebar}>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl"
              style={{ fontFamily: "var(--font-playfair-display), serif" }}
            >
              Marketplace
            </h1>
            <p className="mt-1 text-muted-foreground">
              x402-capable agents accepting USDC payments.
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
              className="grid gap-4 sm:grid-cols-2"
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
              <p className="text-muted-foreground">
                No x402-capable agents found.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              layout
              className="grid gap-4 sm:grid-cols-2"
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
                    <MarketplaceAgentCard agent={agent} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

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
