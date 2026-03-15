"use client";

import { formatUnits } from "viem";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DataListing } from "@/lib/data-marketplace";

const CATEGORY_COLORS: Record<string, string> = {
  "market-data": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  research: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  regulatory: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  scientific: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "ai-intelligence": "bg-pink-500/10 text-pink-600 border-pink-500/20",
};

function formatDate(timestamp: string) {
  const ts = Number(timestamp);
  if (!ts || isNaN(ts)) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface AgentArtifactCardProps {
  listing: DataListing;
  agentName?: string;
  runSummary?: string;
  onViewDetails: () => void;
}

export function AgentArtifactCard({
  listing,
  agentName,
  runSummary,
  onViewDetails,
}: AgentArtifactCardProps) {
  const priceDisplay = `$${formatUnits(BigInt(listing.priceUsdc), 6)}`;
  const categoryStyle =
    CATEGORY_COLORS[listing.category] ??
    "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 flex flex-col gap-4",
        "hover:shadow-md transition-shadow cursor-pointer"
      )}
      onClick={onViewDetails}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onViewDetails();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
              categoryStyle
            )}
          >
            {listing.category}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {listing.license}
          </span>
        </div>
        <span className="text-lg font-bold tabular-nums shrink-0">{priceDisplay}</span>
      </div>

      {/* About */}
      {runSummary && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
          {runSummary}
        </p>
      )}

      {/* Agent & Date */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {agentName ? (
            <span className="font-medium text-foreground">{agentName}</span>
          ) : (
            <span>Agent #{listing.agentId}</span>
          )}
        </span>
        <span>{formatDate(listing.createdAt)}</span>
      </div>

      {/* View details / Buy */}
      <Button
        size="sm"
        className="w-full gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onViewDetails();
        }}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        View details · {priceDisplay} USDC
      </Button>
    </div>
  );
}
