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
  new: "bg-[rgba(168,144,96,0.08)] text-[#a89060] border-[rgba(168,144,96,0.25)]",
  bronze: "bg-[rgba(200,120,40,0.1)] text-[#c87828] border-[rgba(200,120,40,0.3)]",
  silver: "bg-[rgba(180,190,200,0.08)] text-[#b0bcc8] border-[rgba(180,190,200,0.25)]",
  gold: "bg-[rgba(245,217,106,0.1)] text-[#f5d96a] border-[rgba(245,217,106,0.3)]",
  platinum: "bg-[rgba(167,139,250,0.1)] text-[#a78bfa] border-[rgba(167,139,250,0.3)]",
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
      <div className="rounded-lg border border-[rgba(168,144,96,0.18)] bg-card p-4 hover:border-[rgba(245,217,106,0.28)] hover:bg-[rgba(245,217,106,0.02)] transition-all duration-200">
        <div className="flex items-start gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[rgba(168,144,96,0.2)] bg-[#1a1208]">
            {resolvedImg ? (
              <img src={resolvedImg} alt={name} className="h-full w-full object-cover" onError={handleImgError} />
            ) : (
              <img src={agentInitialsSvg(agent.id, name)} alt={name} className="h-full w-full object-cover" draggable={false} />
            )}
            <HealthDot agentId={agent.agentId} networkId={networkId} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#e8dcc8] leading-tight truncate group-hover:text-[#f5d96a] transition-colors">
              {name}
            </p>
            {description && (
              <p className="mt-0.5 text-xs text-[#a89060] line-clamp-2 leading-relaxed">
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
            className="rounded-full border border-[rgba(168,144,96,0.2)] bg-[rgba(168,144,96,0.05)] px-2.5 py-0.5 text-[10px] text-[#a89060] hover:text-[#e8dcc8] transition-colors font-mono"
            title={`Owner: ${agent.owner}`}
          >
            {truncateAddress(agent.owner)}
          </a>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize", TIER_BADGE[cs.tier])}>
            {cs.label}
          </span>
          <span className="rounded-full border border-[rgba(168,144,96,0.18)] bg-[rgba(168,144,96,0.05)] px-2.5 py-0.5 text-[10px] text-[#a89060]">
            {network.name}
          </span>
          {costDisplay && (
            <span className="rounded-full border border-[rgba(167,139,250,0.3)] bg-[rgba(167,139,250,0.08)] px-2.5 py-0.5 text-[10px] font-medium text-[#a78bfa]">
              {costDisplay}
            </span>
          )}
          <span className="ml-auto text-[10px] text-[#a89060] group-hover:text-[#f5d96a] transition-colors font-mono">
            view →
          </span>
        </div>
      </div>
    </Link>
  );
}
