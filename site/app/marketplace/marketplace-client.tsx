"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { RegistryAgentFilterSidebar } from "@/components/filter-sidebar";
import { RegistryAgentCard } from "@/components/agent-card";
import { AgentCardSkeleton } from "@/components/agent-card-skeleton";
import { AgentDetailPanel } from "@/components/agent-detail-panel";
import { RegisterAgentDialog } from "@/components/register-agent-dialog";
import { Slider } from "@/components/ui/slider";
import type { RegistryAgent } from "@/lib/registry";
import type { GetAgentsPageResult } from "@/lib/agents";
import { NETWORKS, NETWORK_IDS, type NetworkId } from "@/lib/networks";
import { computeCreditScore, type CreditTier } from "@/lib/credit-score";
import { parseAgentCardServices } from "@/lib/agent-validator";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;
const CINZEL = "var(--font-cinzel, Cinzel, serif)";
const NETWORK_OPTIONS = NETWORK_IDS.map((id) => ({ id, name: NETWORKS[id].name }));

type SortBy = "default" | "score" | "reviews" | "rating";

const ALL_TIERS: CreditTier[] = ["new", "bronze", "silver", "gold", "platinum"];
const TIER_LABELS: Record<CreditTier, string> = {
  new: "New", bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum",
};

interface MarketplaceClientProps {
  initialData: GetAgentsPageResult;
  initialNetwork: NetworkId;
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[9px] font-semibold uppercase tracking-widest text-[#a89060]/55"
      style={{ fontFamily: CINZEL }}>
      {children}
    </p>
  );
}

function SidebarDivider() {
  return <div className="h-px bg-[rgba(168,144,96,0.12)]" />;
}

function FilterButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded px-2.5 py-1.5 text-left text-sm transition-all duration-150 border",
        active
          ? "bg-[rgba(245,217,106,0.07)] text-[#f5d96a] border-[rgba(245,217,106,0.22)] font-semibold"
          : "text-[#a89060] border-transparent hover:bg-[rgba(245,217,106,0.04)] hover:text-[#e8dcc8] font-normal"
      )}
    >
      {children}
    </button>
  );
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
  const [tierFilter, setTierFilter] = useState<CreditTier | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [maxCostUsdc, setMaxCostUsdc] = useState<number>(10);
  const [x402Only, setX402Only] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [panelAgentId, setPanelAgentId] = useState<string | null>(null);
  const [panelNetworkId, setPanelNetworkId] = useState<NetworkId>(initialNetwork);
  const [panelOpen, setPanelOpen] = useState(false);

  const fetchAgents = useCallback(async (page: number, net: NetworkId) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: PAGE_SIZE.toString(), network: net });
      if (x402Only) params.set("x402", "true");
      if (net === "filecoinCalibration") params.set("noCache", "1");
      const res = await fetch(`/api/agents?${params}`);
      const data = await res.json();
      if (data.success) {
        setAgents(data.items); setCurrentPage(page); setHasMore(data.hasMore); setTotal(data.total);
      } else { setError(data.error ?? "Failed to fetch agents"); }
    } catch (e) { setError(e instanceof Error ? e.message : "Network error"); }
    finally { setIsLoading(false); }
  }, [x402Only]);

  const handleNetworkChange = useCallback((net: string) => {
    const n = net as NetworkId;
    setNetwork(n);
    const next = new URLSearchParams(searchParams.toString());
    next.set("network", n);
    router.push(`/marketplace?${next.toString()}`, { scroll: false });
    fetchAgents(1, n);
  }, [searchParams, router, fetchAgents]);

  useEffect(() => {
    const urlNet = searchParams.get("network") as NetworkId | null;
    if (urlNet && NETWORK_IDS.includes(urlNet) && urlNet !== network) { setNetwork(urlNet); fetchAgents(1, urlNet); }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("register") === "1") setRegisterOpen(true);
  }, [searchParams]);

  useEffect(() => {
    const agent = searchParams.get("agent");
    const net = searchParams.get("network") as NetworkId | null;
    if (agent && net && NETWORK_IDS.includes(net)) {
      setPanelAgentId(agent);
      setPanelNetworkId(net);
      setPanelOpen(true);
    }
  }, [searchParams]);

  const displayedAgents = useMemo(() => {
    let result = agents;
    if (tierFilter) result = result.filter((a) => computeCreditScore(a).tier === tierFilter);
    if (maxCostUsdc < 10) {
      result = result.filter((a) => {
        if (!a.metadata) return false;
        const parsed = parseAgentCardServices(a.metadata as Parameters<typeof parseAgentCardServices>[0]);
        if (!parsed?.cost) return true;
        const cost = parseFloat(parsed.cost);
        return !isNaN(cost) && cost <= maxCostUsdc;
      });
    }
    if (sortBy === "score") {
      result = [...result].sort((a, b) => computeCreditScore(b).score - computeCreditScore(a).score);
    } else if (sortBy === "reviews") {
      result = [...result].sort((a, b) => (b.reputation?.totalFeedback ?? 0) - (a.reputation?.totalFeedback ?? 0));
    } else if (sortBy === "rating") {
      result = [...result].sort((a, b) => (b.reputation?.averageScore ?? 0) - (a.reputation?.averageScore ?? 0));
    }
    return result;
  }, [agents, tierFilter, maxCostUsdc, sortBy]);

  const sidebar = (
    <div className="space-y-4">
      <SidebarDivider />
      <RegistryAgentFilterSidebar network={network} onNetworkChange={handleNetworkChange} networks={NETWORK_OPTIONS} />
      <SidebarDivider />

      <div className="space-y-1.5">
        <SidebarLabel>Protocol</SidebarLabel>
        <label className="flex items-center gap-2.5 cursor-pointer px-2.5 py-1.5 rounded hover:bg-[rgba(245,217,106,0.04)] transition-colors">
          <input
            type="checkbox"
            checked={x402Only}
            onChange={(e) => { setX402Only(e.target.checked); fetchAgents(1, network); }}
            className="rounded border-[rgba(168,144,96,0.4)] bg-transparent accent-[#f5d96a] h-3.5 w-3.5"
          />
          <span className="text-sm text-[#a89060]">x402 only</span>
        </label>
      </div>

      <SidebarDivider />

      <div className="space-y-1.5">
        <SidebarLabel>Credit Tier</SidebarLabel>
        <div className="flex flex-col gap-0.5">
          <FilterButton active={tierFilter === null} onClick={() => setTierFilter(null)}>All tiers</FilterButton>
          {ALL_TIERS.map((t) => (
            <FilterButton key={t} active={tierFilter === t} onClick={() => setTierFilter(tierFilter === t ? null : t)}>
              {TIER_LABELS[t]}
            </FilterButton>
          ))}
        </div>
      </div>

      <SidebarDivider />

      <div className="space-y-1.5">
        <SidebarLabel>Sort By</SidebarLabel>
        <div className="flex flex-col gap-0.5">
          {([
            ["default",  "Default (newest)"],
            ["score",    "Credit Score ↓"],
            ["reviews",  "Most Reviews ↓"],
            ["rating",   "Best Rated ↓"],
          ] as [SortBy, string][]).map(([key, label]) => (
            <FilterButton key={key} active={sortBy === key} onClick={() => setSortBy(key)}>
              {label}
            </FilterButton>
          ))}
        </div>
      </div>

      <SidebarDivider />

      <div className="space-y-2">
        <SidebarLabel>Max Cost</SidebarLabel>
        <span className="block px-1 text-xs text-[#a89060]">
          Up to {maxCostUsdc === 10 ? "any" : `${maxCostUsdc.toFixed(2)} USDC`}
        </span>
        <Slider value={[maxCostUsdc]} onValueChange={(v) => setMaxCostUsdc(v[0])} min={0} max={10} step={0.1} className="w-full" />
      </div>
    </div>
  );

  return (
    <WorkspaceLayout sidebar={sidebar}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-widest text-[#f5d96a] md:text-3xl" style={{ fontFamily: CINZEL }}>
              Marketplace
            </h1>
            <p className="mt-1 text-sm text-[#a89060]">
              Registered agents and data artifacts.
              {!isLoading && total > 0 && (
                <span className="ml-1 font-medium text-[#e8dcc8]">
                  {total} agent{total !== 1 ? "s" : ""} found.
                </span>
              )}
              {sortBy !== "default" && (
                <span className="ml-2 rounded border border-[rgba(245,217,106,0.22)] bg-[rgba(245,217,106,0.07)] px-1.5 py-0.5 text-[11px] text-[#f5d96a]">
                  {sortBy === "score" ? "by credit score" : sortBy === "reviews" ? "by most reviews" : "by best rating"}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRegisterOpen(true)}
              className="rounded border border-[rgba(245,217,106,0.3)] bg-[rgba(245,217,106,0.08)] px-4 py-2 text-sm font-medium text-[#f5d96a] hover:bg-[rgba(245,217,106,0.15)] hover:border-[rgba(245,217,106,0.5)] transition-colors"
              style={{ fontFamily: CINZEL }}
            >
              Register Agent
            </button>
            <button
              onClick={() => fetchAgents(currentPage, network)}
              disabled={isLoading}
              title="Refresh"
              className="rounded p-2 text-[#a89060] hover:text-[#f5d96a] hover:bg-[rgba(245,217,106,0.06)] transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-[rgba(200,60,60,0.3)] bg-[rgba(200,60,60,0.04)] py-16 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => fetchAgents(currentPage, network)}
                className="mt-4 rounded border border-[rgba(168,144,96,0.3)] px-4 py-1.5 text-xs text-[#a89060] hover:border-[rgba(245,217,106,0.4)] hover:text-[#f5d96a] transition-colors"
              >
                Retry
              </button>
            </motion.div>
          ) : isLoading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => <AgentCardSkeleton key={i} />)}
            </motion.div>
          ) : displayedAgents.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-dashed border-[rgba(168,144,96,0.2)] bg-[rgba(168,144,96,0.02)] py-16 text-center">
              <p className="text-sm text-[#a89060]">No agents found.</p>
            </motion.div>
          ) : (
            <motion.div key="grid" layout
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              initial="hidden" animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
            >
              <AnimatePresence mode="popLayout">
                {displayedAgents.map((agent) => (
                  <motion.div key={agent.id} layout
                    variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.3 }}
                  >
                    <RegistryAgentCard
                      agent={agent}
                      compact
                      onAgentClick={() => {
                        setPanelAgentId(agent.agentId);
                        setPanelNetworkId(agent.networkId ?? network);
                        setPanelOpen(true);
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {!isLoading && !error && displayedAgents.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-[#a89060]">
              Page {currentPage} · {displayedAgents.length} of {total}
            </p>
            <div className="flex items-center gap-2">
              {[
                { label: "← Previous", disabled: currentPage === 1 || isLoading, onClick: () => fetchAgents(currentPage - 1, network) },
                { label: "Next →", disabled: !hasMore || isLoading, onClick: () => fetchAgents(currentPage + 1, network) },
              ].map(({ label, disabled, onClick }) => (
                <button key={label} onClick={onClick} disabled={disabled}
                  className="rounded border border-[rgba(168,144,96,0.25)] px-3 py-1.5 text-xs text-[#a89060] hover:border-[rgba(245,217,106,0.4)] hover:text-[#f5d96a] transition-colors disabled:opacity-35 disabled:cursor-not-allowed">
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <RegisterAgentDialog open={registerOpen} onOpenChange={setRegisterOpen} onSuccess={() => fetchAgents(1, network)} />
      <AgentDetailPanel
        agentId={panelAgentId}
        networkId={panelNetworkId}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        agentRows={[]}
      />
    </WorkspaceLayout>
  );
}
