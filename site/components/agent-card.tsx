"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Agent } from "@/lib/data";
import type { RegistryAgent } from "@/lib/registry";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TagBadge } from "@/components/tag-badge";
import { cn } from "@/lib/utils";
import { getExplorerUrl, getExplorerAddressUrl, getNetwork } from "@/lib/networks";

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
          <span>{agent.installedMemories} memories</span>
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

// ── Registry agent card (ancient game player card style) ──────────────────────

const PROTOCOL_COLORS: Record<string, string> = {
  MCP: "bg-emerald-900/80 text-amber-100 border-amber-700/50",
  A2A: "bg-blue-900/80 text-amber-100 border-blue-700/50",
  CUSTOM: "bg-amber-900/60 text-amber-100 border-amber-600/50",
};

function truncateAddress(address: string): string {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ── Local SVG avatar (no external API) ─────────────────────────────────────

const AVATAR_PALETTES = [
  ["#3b1f0e", "#c97c2a"], // amber leather
  ["#0f2b1c", "#4caf7a"], // forest green
  ["#1a2744", "#6a8fd8"], // navy blue
  ["#26133d", "#a87ad4"], // deep plum
  ["#2e1808", "#d4935a"], // rust
  ["#0f2828", "#4abdb0"], // teal
  ["#2d1515", "#c96060"], // burgundy
  ["#1a1a2e", "#8080d0"], // midnight blue
];

function agentAvatarSvg(seed: string, name: string): string {
  // Simple deterministic hash
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const palette = AVATAR_PALETTES[Math.abs(h) % AVATAR_PALETTES.length];
  const [bg, fg] = palette;

  // Initials: up to 2 chars from non-"Agent" words
  const words = name.replace(/^Agent\s*#?\d*\s*/i, "").trim().split(/\s+/).filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (name.replace(/\s+/g, "").slice(0, 2).toUpperCase() || "?");

  // Subtle grid pattern for texture
  const gridSize = 12;
  const gridOpacity = 0.08;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
    <defs>
      <pattern id="g" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
        <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="${fg}" stroke-width="0.5" opacity="${gridOpacity}"/>
      </pattern>
      <radialGradient id="grd" cx="40%" cy="35%">
        <stop offset="0%" stop-color="${fg}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="128" height="128" fill="${bg}"/>
    <rect width="128" height="128" fill="url(#g)"/>
    <rect width="128" height="128" fill="url(#grd)"/>
    <text x="64" y="74" text-anchor="middle" dominant-baseline="middle"
      font-family="Georgia, serif" font-size="46" font-weight="bold"
      fill="${fg}" opacity="0.92" letter-spacing="2">${initials}</text>
    <rect width="128" height="128" fill="none" stroke="${fg}" stroke-width="2" opacity="0.15" rx="2"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ── Live health dot ────────────────────────────────────────────────────────────

export function HealthDot({ agentId, networkId }: { agentId: string; networkId: string }) {
  const [status, setStatus] = useState<"ok" | "unreachable" | "unknown">("unknown");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/agents/${agentId}/health?network=${networkId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStatus(d.status === "ok" ? "ok" : "unreachable");
      })
      .catch(() => {
        if (!cancelled) setStatus("unreachable");
      });
    return () => { cancelled = true; };
  }, [agentId, networkId]);

  if (status === "unknown") return null;

  return (
    <span
      title={status === "ok" ? "Agent is live" : "Agent unreachable"}
      className={cn(
        "absolute top-1.5 right-1.5 h-2 w-2 rounded-full border border-background",
        status === "ok" ? "bg-emerald-500" : "bg-zinc-400"
      )}
    />
  );
}

// ── Registry agent card ────────────────────────────────────────────────────────

interface RegistryAgentCardProps {
  agent: RegistryAgent;
}

export function RegistryAgentCard({ agent }: RegistryAgentCardProps) {
  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`;
  const description = agent.metadata?.description;
  const image = agent.metadata?.image;
  const x402 = agent.metadata?.x402Support;
  const networkId = agent.networkId ?? "sepolia";
  const network = getNetwork(networkId);
  const explorerHref = getExplorerUrl(networkId, agent.agentId);
  const [imgError, setImgError] = useState(false);
  const handleImgError = useCallback(() => setImgError(true), []);

  const resolvedImgSrc = image && !imgError
    ? (image.startsWith("ipfs://") ? image.replace("ipfs://", "https://ipfs.io/ipfs/") : image)
    : null;

  return (
    <Link
      href={`/agents/${networkId}/${agent.agentId}`}
      className="group block h-full"
    >
      <article
        className={cn(
          "relative flex h-full flex-col overflow-hidden",
          "rounded-md",
          "bg-gradient-to-b from-amber-50/95 via-stone-100/90 to-amber-100/95",
          "dark:from-amber-950/90 dark:via-stone-900/80 dark:to-amber-950/90",
          "border border-amber-800/40 dark:border-amber-600/30",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_2px_8px_rgba(0,0,0,0.12)]",
          "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]",
          "transition-all duration-300 hover:scale-[1.02] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_4px_16px_rgba(0,0,0,0.18)]",
          "dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_16px_rgba(0,0,0,0.4)]"
        )}
      >
        {/* Ornate corner flourishes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
          <div className="absolute -left-1 -top-1 h-8 w-8 rounded-br-full border-b border-r border-amber-700/30 dark:border-amber-500/20" />
          <div className="absolute -right-1 -top-1 h-8 w-8 rounded-bl-full border-b border-l border-amber-700/30 dark:border-amber-500/20" />
          <div className="absolute -bottom-1 -left-1 h-8 w-8 rounded-tr-full border-r border-t border-amber-700/30 dark:border-amber-500/20" />
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-tl-full border-l border-t border-amber-700/30 dark:border-amber-500/20" />
        </div>

        {/* Portrait frame */}
        <div className="relative mx-2 mt-2">
          <div
            className={cn(
              "relative aspect-square overflow-hidden rounded-sm",
              "border border-amber-800/50 dark:border-amber-600/40",
              "bg-gradient-to-br from-amber-200/50 to-stone-300/50 dark:from-amber-900/50 dark:to-stone-800/50",
              "shadow-[inset_0_1px_4px_rgba(0,0,0,0.1)]"
            )}
          >
            {resolvedImgSrc ? (
              <img
                src={resolvedImgSrc}
                alt={name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={handleImgError}
              />
            ) : (
              <img
                src={agentAvatarSvg(agent.id, name)}
                alt={name}
                className="h-full w-full object-cover"
                draggable={false}
              />
            )}
            <div className="absolute inset-0.5 rounded-sm border border-amber-600/20 dark:border-amber-500/10" />
            <HealthDot agentId={agent.agentId} networkId={networkId} />
          </div>
          <div
            className={cn(
              "absolute -bottom-1 left-1/2 -translate-x-1/2",
              "rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
              "bg-amber-800/90 text-amber-100 dark:bg-amber-700/90"
            )}
          >
            #{agent.agentId}
          </div>
        </div>

        {/* Name banner */}
        <div className="mt-2 px-2">
          <h3
            className={cn(
              "text-center font-display text-sm font-bold tracking-wide text-amber-900 dark:text-amber-100",
              "line-clamp-2"
            )}
            style={{ fontFamily: "var(--font-playfair-display), serif" }}
          >
            {name}
          </h3>
          <a
            href={getExplorerAddressUrl(networkId, agent.owner)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 block text-center font-mono text-[9px] text-amber-700/80 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100 transition-colors"
            title={`Owner: ${agent.owner}`}
          >
            Owner: {truncateAddress(agent.owner)}
          </a>
        </div>

        {/* Divider */}
        <div className="mx-2 mt-2 flex items-center gap-1">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/40 to-transparent dark:via-amber-500/30" />
          <span className="text-[8px] text-amber-600/60 dark:text-amber-400/40">◆</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/40 to-transparent dark:via-amber-500/30" />
        </div>

        {/* Abilities / protocols */}
        <div className="flex-1 px-2 py-2">
          {description && (
            <p className="line-clamp-2 text-[11px] leading-snug text-amber-900/80 dark:text-amber-200/80">
              {description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap justify-center gap-1">
            {agent.protocols.map((p) => (
              <span
                key={p}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                  PROTOCOL_COLORS[p] ?? PROTOCOL_COLORS.CUSTOM
                )}
              >
                {p}
              </span>
            ))}
            <span className="rounded border border-amber-700/40 bg-amber-900/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-800/20 dark:text-amber-200">
              {network.name}
            </span>
            {x402 && (
              <span className="rounded border border-violet-600/50 bg-violet-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-violet-200">
                x402
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "flex items-center justify-between border-t border-amber-800/30 px-2 py-1.5 dark:border-amber-600/20",
            "bg-amber-900/5 dark:bg-amber-950/30"
          )}
        >
          <span className="text-[10px] font-medium text-amber-800 dark:text-amber-200">
            View Details →
          </span>
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(explorerHref, "_blank", "noopener,noreferrer");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                window.open(explorerHref, "_blank", "noopener,noreferrer");
              }
            }}
            className="cursor-pointer text-[9px] text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100"
          >
            {network.explorerName} ↗
          </span>
        </div>
      </article>
    </Link>
  );
}
