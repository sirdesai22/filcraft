"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Star,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AgentDetail, AgentMetadata } from "@/lib/registry";
import { getExplorerUrl, getNetwork, NETWORK_IDS, type NetworkId } from "@/lib/networks";
import { GiveFeedback } from "@/components/give-feedback";

// ── helpers ──────────────────────────────────────────────────────────────────

function truncateAddress(addr: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

const PROTOCOL_BADGE: Record<string, string> = {
  MCP: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
  A2A: "bg-blue-500/10 text-blue-500 border border-blue-500/30",
  CUSTOM: "bg-amber-500/10 text-amber-600 border border-amber-500/30",
};

// ── sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono = false,
  canCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  canCopy?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`truncate text-sm ${mono ? "font-mono" : ""}`}
          title={value}
        >
          {value}
        </span>
        {canCopy && (
          <button
            onClick={() => copyText(value)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function EndpointSection({
  type,
  endpoint,
  items,
  itemLabel,
}: {
  type: string;
  endpoint: string;
  items?: string[];
  itemLabel: string;
}) {
  const badge = PROTOCOL_BADGE[type] ?? PROTOCOL_BADGE.CUSTOM;
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>
          {type}
        </span>
        <span className="text-sm font-medium">Endpoint</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">
          {endpoint}
        </code>
        <button
          onClick={() => copyText(endpoint)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      {items && items.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">{itemLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span
                key={item}
                className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-mono"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Raw metadata card with clipping ──────────────────────────────────────────

const RAW_URI_LIMIT = 200;
const RAW_JSON_LIMIT = 3000;

function RawMetadataCard({
  agentURI,
  metadata,
}: {
  agentURI: string;
  metadata: AgentMetadata | null;
}) {
  const [expandedURI, setExpandedURI] = useState(false);
  const [expandedJSON, setExpandedJSON] = useState(false);

  const fullJSON = JSON.stringify(metadata, null, 2);
  const uriClipped = agentURI.length > RAW_URI_LIMIT;
  const jsonClipped = fullJSON.length > RAW_JSON_LIMIT;

  return (
    <Card className="border-border overflow-hidden">
      <CardHeader className="pb-3">
        <h2 className="font-semibold text-sm">Raw Metadata</h2>
        <p className="text-xs text-muted-foreground">Parsed from</p>
        <div className="mt-1 max-w-full overflow-x-auto rounded bg-muted px-2 py-1.5">
          <code className="font-mono text-xs break-all whitespace-pre-wrap">
            {expandedURI || !uriClipped
              ? agentURI
              : `${agentURI.slice(0, RAW_URI_LIMIT)}…`}
          </code>
          {uriClipped && (
            <button
              onClick={() => setExpandedURI((v) => !v)}
              className="ml-1 text-xs font-medium text-primary hover:underline"
            >
              {expandedURI ? "Show less" : "Show full URI"}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed whitespace-pre-wrap break-words">
          <code>
            {expandedJSON || !jsonClipped
              ? fullJSON
              : `${fullJSON.slice(0, RAW_JSON_LIMIT)}\n…`}
          </code>
        </pre>
        {jsonClipped && (
          <button
            onClick={() => setExpandedJSON((v) => !v)}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            {expandedJSON ? "Show less" : `Show all (${(fullJSON.length / 1024).toFixed(1)} KB)`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "raw";

export default function AgentDetailPage() {
  const params = useParams<{ network: string; id: string }>();
  const networkParam = params.network ?? "baseSepolia";
  const networkId: NetworkId = NETWORK_IDS.includes(networkParam as NetworkId)
    ? (networkParam as NetworkId)
    : "baseSepolia";
  const id = params.id;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const network = getNetwork(networkId);
  const explorerUrl = getExplorerUrl(networkId, id ?? "");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/agents/${id}?network=${networkId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAgent(data.agent);
        else setError(data.error ?? "Failed to load agent");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [id, networkId]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Fetching agent…</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="container px-4 py-12 md:px-6">
        <Link
          href={`/agents?network=${networkId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <h1
            className="font-display text-2xl font-bold"
            style={{ fontFamily: "var(--font-playfair-display), serif" }}
          >
            Agent not found
          </h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const { metadata, protocols, reputation } = agent;
  const name = metadata?.name ?? `Agent #${agent.agentId}`;
  const image = metadata?.image?.startsWith("ipfs://")
    ? metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")
    : metadata?.image;

  return (
    <div className="container px-4 py-8 md:px-6 max-w-5xl">
      {/* Back */}
      <Link
        href={`/agents?network=${networkId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Agents
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="flex gap-5 items-start">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center text-4xl">
            {image ? (
              <img src={image} alt={name} className="h-full w-full object-cover" />
            ) : (
              "🤖"
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {network.name} · #{agent.agentId}
              </span>
              {metadata?.active === false && (
                <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-xs font-medium text-red-500">
                  Inactive
                </span>
              )}
            </div>
            <h1
              className="font-display text-2xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-playfair-display), serif" }}
            >
              {name}
            </h1>
            {metadata?.description && (
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                {metadata.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {protocols.map((p) => (
                <span
                  key={p}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PROTOCOL_BADGE[p] ?? PROTOCOL_BADGE.CUSTOM}`}
                >
                  {p}
                </span>
              ))}
              {metadata?.x402Support && (
                <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-2.5 py-0.5 text-xs font-medium text-violet-500">
                  x402
                </span>
              )}
            </div>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
            {network.explorerName}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-6 border-b border-border">
        {(["overview", "raw"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "raw" ? "Raw Metadata" : "Overview"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Reputation stats */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Reputation
                  </h2>
                  <GiveFeedback
                    agentId={agent.agentId}
                    networkId={networkId}
                    onSuccess={async () => {
                      await fetch("/api/agents/revalidate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id, network: networkId }),
                      });
                      const r = await fetch(`/api/agents/${id}?network=${networkId}`);
                      const d = await r.json();
                      if (d.agent) setAgent(d.agent);
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                    <div className="text-2xl font-bold">
                      {reputation.totalFeedback}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Total Reviews
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                    <div className="text-2xl font-bold">
                      {reputation.averageScore !== null
                        ? reputation.averageScore.toFixed(1)
                        : "—"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Star className="h-3 w-3" />
                      Avg Score
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints */}
            {(metadata?.mcpEndpoint || metadata?.a2aEndpoint) && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Endpoints
                  </h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  {metadata.mcpEndpoint && (
                    <EndpointSection
                      type="MCP"
                      endpoint={metadata.mcpEndpoint}
                      items={metadata.mcpTools}
                      itemLabel="Tools"
                    />
                  )}
                  {metadata.a2aEndpoint && (
                    <EndpointSection
                      type="A2A"
                      endpoint={metadata.a2aEndpoint}
                      items={metadata.a2aSkills}
                      itemLabel="Skills"
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Supported trusts */}
            {metadata?.supportedTrusts && metadata.supportedTrusts.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <h2 className="font-semibold text-sm">Supported Trusts</h2>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.supportedTrusts.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <Card className="border-border">
              <CardHeader className="pb-3">
                <h2 className="font-semibold text-sm">Details</h2>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <InfoRow
                  label="Agent ID"
                  value={agent.agentId}
                  mono
                  canCopy
                />
                <InfoRow
                  label="Owner"
                  value={truncateAddress(agent.owner)}
                  mono
                  canCopy
                />
                {agent.agentURI && (
                  <InfoRow
                    label="Agent URI"
                    value={agent.agentURI}
                    mono
                    canCopy
                  />
                )}
                <InfoRow
                  label="Network"
                  value={network.name}
                />
                <InfoRow
                  label="Standard"
                  value="ERC-8004"
                />
                {metadata?.active !== undefined && metadata.active !== null && (
                  <InfoRow
                    label="Status"
                    value={metadata.active ? "Active" : "Inactive"}
                  />
                )}
                {metadata?.x402Support && (
                  <InfoRow label="x402" value="Supported" />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "raw" && <RawMetadataCard agentURI={agent.agentURI} metadata={metadata} />}
    </div>
  );
}
