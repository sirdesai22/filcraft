"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AgentArtifactCard } from "@/components/agent-artifact-card";
import { ArtifactDetailsDialog } from "@/components/artifact-details-dialog";
import type { DataListing } from "@/lib/data-marketplace";
import { getNetwork, type NetworkId } from "@/lib/networks";
import type { AgentEconomyAccount } from "@/lib/economy";

const PROTOCOL_BADGE: Record<string, string> = {
  MCP: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
  A2A: "bg-blue-500/10 text-blue-500 border border-blue-500/30",
  CUSTOM: "bg-amber-500/10 text-amber-600 border border-amber-500/30",
};

type Tab = "economy" | "artifacts" | "activity";

interface AgentRow {
  agentId: string;
  networkId: string;
  name: string;
  economy: AgentEconomyAccount;
  completedRuns: number;
}

interface AgentDetailPanelProps {
  agentId: string | null;
  networkId: NetworkId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentRows?: AgentRow[];
}

export function AgentDetailPanel({
  agentId,
  networkId,
  open,
  onOpenChange,
  agentRows = [],
}: AgentDetailPanelProps) {
  const [agent, setAgent] = useState<{
    agentId: string;
    metadata?: { name?: string; description?: string; image?: string; x402Support?: boolean };
    protocols: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("economy");

  useEffect(() => {
    if (!open || !agentId) return;
    setLoading(true);
    setAgent(null);
    fetch(`/api/agents/${agentId}?network=${networkId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.agent) setAgent(data.agent);
      })
      .finally(() => setLoading(false));
  }, [open, agentId, networkId]);

  const network = getNetwork(networkId);
  const name = agent?.metadata?.name ?? `Agent #${agentId}`;
  const image = agent?.metadata?.image?.startsWith("ipfs://")
    ? agent.metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")
    : agent?.metadata?.image;

  const economyRow = agent ? agentRows.find((r) => r.agentId === agent.agentId) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-0 p-0"
        showCloseButton={true}
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading agent…</p>
            </div>
          </div>
        ) : agent ? (
          <>
            <SheetHeader className="p-4 border-b border-border shrink-0">
              <div className="flex gap-4 items-start">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center text-2xl">
                  {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    "🤖"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg">{name}</SheetTitle>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {network.name} · #{agent.agentId}
                    </span>
                    {agent.protocols.map((p) => (
                      <span
                        key={p}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PROTOCOL_BADGE[p] ?? PROTOCOL_BADGE.CUSTOM}`}
                      >
                        {p}
                      </span>
                    ))}
                    {agent.metadata?.x402Support && (
                      <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[10px] font-medium text-violet-500">
                        x402
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                  <Link href={`/agents/${networkId}/${agentId}`}>
                    View full page
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
                {networkId === "filecoinCalibration" && (
                  <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                    <Link href={`/?focus=${agentId}`}>View in World</Link>
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="flex gap-4 px-4 py-2 border-b border-border shrink-0">
              {(["economy", "artifacts", "activity"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`text-sm font-medium capitalize transition-colors ${
                    tab === t
                      ? "border-b-2 border-foreground text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "economy" && (
                <EconomyTabContent
                  agentId={agent.agentId}
                  networkId={networkId}
                  economyRow={economyRow}
                  agentRows={agentRows}
                />
              )}
              {tab === "artifacts" && (
                <ArtifactsTabContent
                  agentId={agent.agentId}
                  agentName={name}
                />
              )}
              {tab === "activity" && <ActivityTabContent agentId={agent.agentId} />}
            </div>
          </>
        ) : agentId && !loading ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">Agent not found.</p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EconomyTabContent({
  agentId,
  networkId,
  economyRow,
  agentRows,
}: {
  agentId: string;
  networkId: string;
  economyRow?: AgentRow;
  agentRows: AgentRow[];
}) {
  const [data, setData] = useState<{ agentRows?: AgentRow[] } | null>(null);
  const [loading, setLoading] = useState(!economyRow);

  useEffect(() => {
    if (economyRow) return;
    fetch(`/api/economy?agentIds=${agentId}&network=${networkId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [agentId, networkId, economyRow]);

  const row = economyRow ?? data?.agentRows?.find((r) => r.agentId === agentId);

  if (loading || !row) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          {loading ? "Loading economy data…" : "No economy data for this agent."}
        </CardContent>
      </Card>
    );
  }

  const { economy } = row;
  const balanceNum = Number(BigInt(economy.balance)) / 1e18;
  const spentNum = Number(BigInt(economy.totalSpent)) / 1e18;
  const earnedNum = Number(BigInt(economy.totalEarned)) / 100;

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Economy
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</div>
              <div className="text-lg font-bold">{balanceNum.toFixed(4)} tFIL</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Revenue</div>
              <div className="text-lg font-bold">${earnedNum.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Storage Cost</div>
              <div className="text-lg font-bold">{spentNum.toFixed(4)} tFIL</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</div>
              <div
                className={`text-sm font-semibold ${
                  economy.status === "healthy"
                    ? "text-emerald-500"
                    : economy.status === "at-risk"
                      ? "text-amber-500"
                      : "text-zinc-400"
                }`}
              >
                {economy.status === "healthy" ? "Healthy" : economy.status === "at-risk" ? "At Risk" : "Wound Down"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ArtifactsTabContent({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName?: string;
}) {
  const [listings, setListings] = useState<DataListing[]>([]);
  const [reports, setReports] = useState<Array<{ summary: string; focListingId?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [detailsListing, setDetailsListing] = useState<DataListing | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/data-listings?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/agents/${agentId}/activity`).then((r) => r.json()),
    ]).then(([listingsData, activityData]) => {
      setListings(listingsData?.listings ?? []);
      setReports(activityData?.reports ?? []);
    }).finally(() => setLoading(false));
  }, [agentId]);

  const getRunSummary = (listingId: string) =>
    reports.find((r) => String(r.focListingId) === listingId)?.summary;

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Loading artifacts…
        </CardContent>
      </Card>
    );
  }

  if (listings.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          No data artifacts listed by this agent yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {listings.map((listing) => (
          <AgentArtifactCard
            key={listing.id}
            listing={listing}
            agentName={agentName}
            runSummary={getRunSummary(listing.id)}
            onViewDetails={() => {
              setDetailsListing(listing);
              setDetailsOpen(true);
            }}
          />
        ))}
      </div>
      {detailsListing && (
        <ArtifactDetailsDialog
          listing={detailsListing}
          agentName={agentName}
          runSummary={getRunSummary(detailsListing.id)}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </div>
  );
}

function ActivityTabContent({ agentId }: { agentId: string }) {
  const [data, setData] = useState<{ reports: Array<{ runId: string; createdAt: string; reportUrl: string; summary: string }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/activity`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [agentId]);

  const reports = data?.reports ?? [];

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Loading activity…
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          No completed runs for this agent yet.
        </CardContent>
      </Card>
    );
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="space-y-3">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Recent Runs ({reports.length})
          </h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {reports.map((r) => (
              <div
                key={r.runId}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{r.summary || r.runId}</p>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </div>
                <a
                  href={r.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
