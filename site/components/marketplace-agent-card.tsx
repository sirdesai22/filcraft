"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { RegistryAgent } from "@/lib/registry";
import { getNetwork, getExplorerAddressUrl } from "@/lib/networks";
import { computeCreditScore } from "@/lib/credit-score";
import { parseAgentCardServices } from "@/lib/agent-validator";
import { HealthDot } from "@/components/agent-card";
import { cn } from "@/lib/utils";

const TIER_BADGE: Record<string, string> = {
  new: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
  bronze: "bg-amber-700/10 text-amber-700 border-amber-700/30 dark:text-amber-400 dark:border-amber-500/30",
  silver: "bg-slate-400/10 text-slate-500 border-slate-400/30 dark:text-slate-300 dark:border-slate-400/30",
  gold: "bg-yellow-400/10 text-yellow-600 border-yellow-400/30 dark:text-yellow-300 dark:border-yellow-400/30",
  platinum: "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-300 dark:border-violet-400/30",
};

function truncateAddress(addr: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function agentInitialsSvg(seed: string, name: string): string {
  const PALETTES = [
    ["#1a2744", "#6a8fd8"],
    ["#0f2b1c", "#4caf7a"],
    ["#26133d", "#a87ad4"],
    ["#2e1808", "#d4935a"],
    ["#0f2828", "#4abdb0"],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const [bg, fg] = PALETTES[Math.abs(h) % PALETTES.length];
  const words = name.replace(/^Agent\s*#?\d*\s*/i, "").trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.replace(/\s+/g, "").slice(0, 2).toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <rect width="48" height="48" fill="${bg}" rx="8"/>
    <text x="24" y="28" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-size="18" font-weight="bold" fill="${fg}">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

interface MarketplaceAgentCardProps {
  agent: RegistryAgent;
}

// Replace bare Unix timestamps (10-digit, seconds since epoch) with readable dates
function formatDescription(text: string): string {
  return text.replace(/\b(1[5-9]\d{8}|2\d{9})\b/g, (ts) =>
    new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  );
}

export function MarketplaceAgentCard({ agent }: MarketplaceAgentCardProps) {
  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`;
  const rawDescription = agent.metadata?.description;
  const description = rawDescription ? formatDescription(rawDescription) : undefined;
  const image = agent.metadata?.image;
  const networkId = agent.networkId ?? "sepolia";
  const network = getNetwork(networkId);
  const [imgError, setImgError] = useState(false);
  const handleImgError = useCallback(() => setImgError(true), []);

  const resolvedImg =
    image && !imgError
      ? image.startsWith("ipfs://")
        ? image.replace("ipfs://", "https://ipfs.io/ipfs/")
        : image
      : null;

  const cs = computeCreditScore(agent);

  const parsed = agent.metadata ? parseAgentCardServices(agent.metadata as Parameters<typeof parseAgentCardServices>[0]) : null;
  const costDisplay = parsed?.cost
    ? `${parsed.cost} ${parsed.currency ?? "USDC"}`
    : null;

  return (
    <Link href={`/agents/${networkId}/${agent.agentId}`} className="block group">
      <div className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {resolvedImg ? (
              <img
                src={resolvedImg}
                alt={name}
                className="h-full w-full object-cover"
                onError={handleImgError}
              />
            ) : (
              <img
                src={agentInitialsSvg(agent.id, name)}
                alt={name}
                className="h-full w-full object-cover"
                draggable={false}
              />
            )}
            <HealthDot agentId={agent.agentId} networkId={networkId} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground leading-tight truncate group-hover:underline">
              {name}
            </p>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={getExplorerAddressUrl(networkId, agent.owner)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
            title={`Owner: ${agent.owner}`}
          >
            Owner: {truncateAddress(agent.owner)}
          </a>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
              TIER_BADGE[cs.tier]
            )}
          >
            {cs.label}
          </span>
          <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
            {network.name}
          </span>
          {costDisplay && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-300">
              {costDisplay}
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            Details →
          </span>
        </div>
      </div>
    </Link>
  );
}
