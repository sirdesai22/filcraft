"use client";

import Link from "next/link";
import type { Agent } from "@/lib/data";
import type { RegistryAgent } from "@/lib/registry";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TagBadge } from "@/components/tag-badge";
import { cn } from "@/lib/utils";
import { getExplorerUrl, getNetwork } from "@/lib/networks";

// ── Local dummy agent card (unchanged) ──────────────────────────────────────

interface AgentCardProps {
  agent: Agent;
  onAddClick?: (agent: Agent) => void;
}

export function AgentCard({ agent, onAddClick }: AgentCardProps) {
  const priceLabel = agent.price === "free" ? "Free" : `${agent.price} FIL`;

  return (
    <Card className="flex flex-col overflow-hidden border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
            {agent.avatar}
          </div>
          <div>
            <h3
              className="font-display text-lg font-bold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-playfair-display), serif" }}
            >
              {agent.name}
            </h3>
            <p className="text-sm text-muted-foreground">{agent.author}</p>
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground pt-2">
          {agent.description}
        </p>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {agent.compatibleTags.slice(0, 4).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{agent.installedEpisodes} episodes</span>
          <span>·</span>
          <span className="font-medium text-foreground">{priceLabel}</span>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border pt-4">
        <Button
          className="w-full rounded-full"
          size="sm"
          onClick={() => onAddClick?.(agent)}
        >
          Add Agent
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Registry agent card ──────────────────────────────────────────────────────

const PROTOCOL_COLORS: Record<string, string> = {
  MCP: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
  A2A: "bg-blue-500/10 text-blue-500 border border-blue-500/30",
  CUSTOM: "bg-amber-500/10 text-amber-600 border border-amber-500/30",
};

function truncateAddress(address: string): string {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface RegistryAgentCardProps {
  agent: RegistryAgent;
}

export function RegistryAgentCard({ agent }: RegistryAgentCardProps) {
  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`;
  const description = agent.metadata?.description;
  const image = agent.metadata?.image;
  const x402 = agent.metadata?.x402Support;
  const networkId = agent.networkId ?? "baseSepolia";
  const network = getNetwork(networkId);
  const explorerHref = getExplorerUrl(networkId, agent.agentId);

  return (
    <Card className="flex flex-col overflow-hidden border border-border bg-card shadow-sm transition-shadow hover:shadow-md h-full group">
      <Link
        href={`/agents/${networkId}/${agent.agentId}`}
        className="block flex-1 min-h-0"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden text-2xl"
              )}
            >
              {image ? (
                <img
                  src={
                    image.startsWith("ipfs://")
                      ? image.replace("ipfs://", "https://ipfs.io/ipfs/")
                      : image
                  }
                  alt={name}
                  className="h-12 w-12 object-cover"
                />
              ) : (
                "🤖"
              )}
            </div>
            <div className="min-w-0">
              <h3
                className="font-display text-lg font-bold tracking-tight text-foreground truncate"
                style={{ fontFamily: "var(--font-playfair-display), serif" }}
              >
                {name}
              </h3>
              <p className="text-xs font-mono text-muted-foreground">
                {truncateAddress(agent.owner)}
              </p>
            </div>
          </div>
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground pt-2">
              {description}
            </p>
          )}
        </CardHeader>

        <CardContent className="flex-1 space-y-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {agent.protocols.map((p) => (
              <span
                key={p}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  PROTOCOL_COLORS[p] ?? PROTOCOL_COLORS.CUSTOM
                )}
              >
                {p}
              </span>
            ))}
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {network.name}
            </span>
            {x402 && (
              <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-2.5 py-0.5 text-xs font-medium text-violet-500">
                x402
              </span>
            )}
          </div>
        </CardContent>
      </Link>

      <CardFooter className="border-t border-border pt-4">
        <div className="flex w-full items-center justify-between">
          <Link
            href={`/agents/${networkId}/${agent.agentId}`}
            className="text-sm font-medium text-foreground group-hover:underline underline-offset-4"
          >
            View Details →
          </Link>
          <a
            href={explorerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {network.explorerName} ↗
          </a>
        </div>
      </CardFooter>
    </Card>
  );
}
