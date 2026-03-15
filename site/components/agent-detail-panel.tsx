"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Star,
  Terminal,
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
import { GiveFeedback } from "@/components/give-feedback";
import type { DataListing } from "@/lib/data-marketplace";
import { getNetwork, getExplorerAddressUrl, getExplorerUrl, type NetworkId } from "@/lib/networks";
import type { AgentEconomyAccount } from "@/lib/economy";
import type { AgentDetail, AgentMetadata } from "@/lib/registry";
import type { ParsedServices } from "@/lib/agent-validator";
import { computeCreditScore } from "@/lib/credit-score";

const PROTOCOL_BADGE: Record<string, string> = {
  MCP: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
  A2A: "bg-blue-500/10 text-blue-500 border border-blue-500/30",
  CUSTOM: "bg-amber-500/10 text-amber-600 border border-amber-500/30",
};

const TIER_BADGE_CLASS: Record<string, string> = {
  new: "bg-zinc-500/10 text-zinc-500 border border-zinc-500/30",
  bronze: "bg-amber-700/10 text-amber-700 border border-amber-700/30 dark:text-amber-400",
  silver: "bg-slate-400/10 text-slate-500 border border-slate-400/30 dark:text-slate-300",
  gold: "bg-yellow-400/10 text-yellow-600 border border-yellow-400/30 dark:text-yellow-300",
  platinum: "bg-violet-500/10 text-violet-600 border border-violet-500/30 dark:text-violet-300",
};

type Tab = "overview" | "invoke" | "score" | "economy" | "artifacts" | "activity" | "raw";

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

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export function AgentDetailPanel({
  agentId,
  networkId,
  open,
  onOpenChange,
  agentRows = [],
}: AgentDetailPanelProps) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [invocationGuide, setInvocationGuide] = useState<ParsedServices | null>(null);
  const [healthStatus, setHealthStatus] = useState<"ok" | "unreachable" | "unknown">("unknown");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!open || !agentId) return;
    setLoading(true);
    setAgent(null);
    setInvocationGuide(null);
    setHealthStatus("unknown");
    fetch(`/api/agents/${agentId}?network=${networkId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.agent) {
          setAgent(data.agent);
          if (data.invocationGuide) setInvocationGuide(data.invocationGuide);
        }
      })
      .finally(() => setLoading(false));

    fetch(`/api/agents/${agentId}/health?network=${networkId}`)
      .then((r) => r.json())
      .then((d) => setHealthStatus(d.status === "ok" ? "ok" : "unreachable"))
      .catch(() => setHealthStatus("unreachable"));
  }, [open, agentId, networkId]);

  const network = getNetwork(networkId);
  const name = agent?.metadata?.name ?? `Agent #${agentId}`;
  const image = agent?.metadata?.image?.startsWith("ipfs://")
    ? agent.metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")
    : agent?.metadata?.image;
  const economyRow = agent ? agentRows.find((r) => r.agentId === agent.agentId) : undefined;
  const explorerUrl = agentId ? getExplorerUrl(networkId, agentId) : "";

  const tabs: Tab[] = ["overview", "invoke", "score", "economy", "artifacts", "activity", "raw"];
  const tabLabels: Record<Tab, string> = {
    overview: "Overview",
    invoke: "Invoke",
    score: "Score",
    economy: "Economy",
    artifacts: "Artifacts",
    activity: "Activity",
    raw: "Raw",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-0 p-0"
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
                {networkId === "filecoinCalibration" && (
                  <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                    <Link href={`/?focus=${agentId}`}>View in World</Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                  <Link href={`/agents/update?id=${agentId}&network=${networkId}`}>Update URI</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                    {network.explorerName}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </div>
            </SheetHeader>

            <div className="flex gap-2 px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`shrink-0 text-xs font-medium capitalize transition-colors px-2 py-1.5 rounded ${
                    tab === t
                      ? "border-b-2 border-foreground text-foreground bg-muted/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tabLabels[t]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "overview" && (
                <OverviewTabContent
                  agent={agent}
                  networkId={networkId}
                  onAgentUpdated={() => {
                    fetch(`/api/agents/${agentId}?network=${networkId}`)
                      .then((r) => r.json())
                      .then((d) => d.agent && setAgent(d.agent));
                  }}
                />
              )}
              {tab === "invoke" && (
                <InvokeTabContent
                  invocationGuide={invocationGuide}
                  healthStatus={healthStatus}
                />
              )}
              {tab === "score" && <ScoreTabContent agent={agent} />}
              {tab === "economy" && (
                <EconomyTabContent
                  agentId={agent.agentId}
                  networkId={networkId}
                  economyRow={economyRow}
                  agentRows={agentRows}
                />
              )}
              {tab === "artifacts" && (
                <ArtifactsTabContent agentId={agent.agentId} agentName={name} />
              )}
              {tab === "activity" && <ActivityTabContent agentId={agent.agentId} agentName={name} />}
              {tab === "raw" && (
                <RawTabContent agentURI={agent.agentURI} metadata={agent.metadata} />
              )}
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

function InfoRow({
  label,
  value,
  mono = false,
  canCopy,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  canCopy?: boolean;
  href?: string;
}) {
  const content = (
    <span
      className={`truncate text-sm ${mono ? "font-mono" : ""} ${href ? "hover:underline" : ""}`}
      title={value}
    >
      {value}
    </span>
  );
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-1.5 text-primary hover:underline"
          >
            {content}
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        ) : (
          content
        )}
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
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>{type}</span>
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

function OverviewTabContent({
  agent,
  networkId,
  onAgentUpdated,
}: {
  agent: AgentDetail;
  networkId: NetworkId;
  onAgentUpdated: () => void;
}) {
  const { metadata, reputation } = agent;
  const network = getNetwork(networkId);

  return (
    <div className="space-y-4">
      {metadata?.active === false && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 flex gap-2 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          This agent is no longer active. Its history remains permanently on Filecoin.
        </div>
      )}

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
              onSuccess={onAgentUpdated}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <div className="text-2xl font-bold">{reputation.totalFeedback}</div>
              <div className="mt-0.5 text-xs text-muted-foreground flex items-center justify-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Total Reviews
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <div className="text-2xl font-bold">
                {reputation.averageScore !== null ? reputation.averageScore.toFixed(1) : "—"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Star className="h-3 w-3" />
                Avg Score
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <Card className="border-border">
        <CardHeader className="pb-3">
          <h2 className="font-semibold text-sm">Details</h2>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <InfoRow label="Agent ID" value={agent.agentId} mono canCopy />
          <InfoRow
            label="Owner"
            value={agent.owner}
            mono
            canCopy
            href={getExplorerAddressUrl(networkId, agent.owner)}
          />
          {agent.agentURI && (
            <InfoRow label="Agent URI" value={agent.agentURI} mono canCopy />
          )}
          <InfoRow label="Network" value={network.name} />
          <InfoRow label="Standard" value="ERC-8004" />
          {metadata?.active !== undefined && metadata.active !== null && (
            <InfoRow label="Status" value={metadata.active ? "Active" : "Inactive"} />
          )}
          {metadata?.x402Support && <InfoRow label="x402" value="Supported" />}
        </CardContent>
      </Card>
    </div>
  );
}

function InvokeTabContent({
  invocationGuide,
  healthStatus,
}: {
  invocationGuide: ParsedServices | null;
  healthStatus: "ok" | "unreachable" | "unknown";
}) {
  if (!invocationGuide) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          This agent has no x402 invocation guide in its card metadata.
        </CardContent>
      </Card>
    );
  }

  const { x402Endpoint, cost, currency, network, inputSchema, healthUrl } = invocationGuide;
  const curlCommand = `curl -X POST "${x402Endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <x402-payment-token>" \\
  -d '${JSON.stringify(
    inputSchema && "properties" in inputSchema
      ? Object.fromEntries(
          Object.keys((inputSchema as { properties: Record<string, unknown> }).properties).map(
            (k) => [k, `<${k}>`]
          )
        )
      : { body: "..." }
  )}'`;

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            Agent Status
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                healthStatus === "ok"
                  ? "bg-emerald-500"
                  : healthStatus === "unreachable"
                    ? "bg-red-500"
                    : "bg-zinc-400"
              }`}
            />
            <span className="text-sm">
              {healthStatus === "ok"
                ? "Live"
                : healthStatus === "unreachable"
                  ? "Unreachable"
                  : "Status unknown"}
            </span>
            {healthUrl && (
              <span className="ml-auto text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                {healthUrl}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-500" />
            x402 Invocation
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Endpoint
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs font-mono">
                {x402Endpoint}
              </code>
              <button
                onClick={() => copyText(x402Endpoint)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Cost
              </p>
              <p className="text-sm font-semibold">{cost ? `${cost} ${currency}` : "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Network
              </p>
              <p className="text-sm font-mono">{network || "—"}</p>
            </div>
          </div>
          {inputSchema && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Input Schema
              </p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed max-h-40 overflow-y-auto">
                {JSON.stringify(inputSchema, null, 2)}
              </pre>
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Example curl
              </p>
              <button
                onClick={() => copyText(curlCommand)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              {curlCommand}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreTabContent({ agent }: { agent: AgentDetail }) {
  const cs = computeCreditScore(agent);
  const { breakdown, score, tier, label, listingFeeBps, escrowFree, insurancePool } = cs;

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Credit Score
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold tabular-nums">{score}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${TIER_BADGE_CLASS[tier]}`}
            >
              {label}
            </span>
          </div>
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(score / 1000) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/60 font-mono">
              0 New · 100 Bronze · 400 Silver · 650 Gold · 850 Platinum
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <h2 className="font-semibold text-sm">Score Breakdown</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Quality", value: breakdown.qualityScore, max: 500 },
            { label: "Volume", value: breakdown.feedbackScore, max: 300 },
            { label: "Longevity", value: breakdown.longevityScore, max: 200 },
          ].map(({ label: l, value, max }) => (
            <div key={l} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{l}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {value} / {max}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <h2 className="font-semibold text-sm">Access Privileges</h2>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Listing Fee
            </span>
            <span className="text-sm font-semibold">{(listingFeeBps / 100).toFixed(2)}%</span>
          </div>
          <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Escrow-Free Settlement
            </span>
            <span
              className={`text-sm font-semibold ${escrowFree ? "text-emerald-500" : "text-muted-foreground"}`}
            >
              {escrowFree ? "✓" : "—"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-2.5">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Insurance Pool
            </span>
            <span
              className={`text-sm font-semibold ${insurancePool ? "text-emerald-500" : "text-muted-foreground"}`}
            >
              {insurancePool ? "✓" : "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
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
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Balance
              </div>
              <div className="text-lg font-bold">{balanceNum.toFixed(4)} tFIL</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Revenue
              </div>
              <div className="text-lg font-bold">${earnedNum.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Storage Cost
              </div>
              <div className="text-lg font-bold">{spentNum.toFixed(4)} tFIL</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Status
              </div>
              <div
                className={`text-sm font-semibold ${
                  economy.status === "healthy"
                    ? "text-emerald-500"
                    : economy.status === "at-risk"
                      ? "text-amber-500"
                      : "text-zinc-400"
                }`}
              >
                {economy.status === "healthy"
                  ? "Healthy"
                  : economy.status === "at-risk"
                    ? "At Risk"
                    : "Wound Down"}
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
  const [reports, setReports] = useState<Array<{ summary: string; focListingId?: string | null }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [detailsListing, setDetailsListing] = useState<DataListing | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/data-listings?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/agents/${agentId}/activity`).then((r) => r.json()),
    ])
      .then(([listingsData, activityData]) => {
        setListings(listingsData?.listings ?? []);
        setReports(activityData?.reports ?? []);
      })
      .finally(() => setLoading(false));
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

function ActivityTabContent({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName?: string;
}) {
  const [data, setData] = useState<{
    reports: Array<{
      runId: string;
      createdAt: string;
      reportUrl: string;
      summary: string;
      focListingId?: string | null;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [artifactDialogListing, setArtifactDialogListing] = useState<DataListing | null>(null);
  const [artifactDialogOpen, setArtifactDialogOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/activity`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [agentId]);

  const fetchListingAndOpen = async (listingId: string) => {
    const res = await fetch(`/api/data-listings/${listingId}`);
    if (!res.ok) return;
    const listing = await res.json();
    setArtifactDialogListing(listing);
    setArtifactDialogOpen(true);
  };

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Loading activity…
        </CardContent>
      </Card>
    );
  }

  const reports = data?.reports ?? [];
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
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{r.summary || r.runId}</p>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.focListingId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => fetchListingAndOpen(String(r.focListingId))}
                    >
                      Buy artifact
                    </Button>
                  )}
                  <a
                    href={r.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {artifactDialogListing && (
        <ArtifactDetailsDialog
          listing={artifactDialogListing}
          agentName={agentName}
          runSummary={
            reports.find((r) => String(r.focListingId) === artifactDialogListing.id)?.summary
          }
          open={artifactDialogOpen}
          onOpenChange={setArtifactDialogOpen}
        />
      )}
    </div>
  );
}

const RAW_URI_LIMIT = 200;
const RAW_JSON_LIMIT = 3000;

function RawTabContent({
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
            {expandedURI || !uriClipped ? agentURI : `${agentURI.slice(0, RAW_URI_LIMIT)}…`}
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
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
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
