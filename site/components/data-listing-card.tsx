"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { ShoppingCart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PurchaseListingModal } from "@/components/purchase-listing-modal";
import type { DataListing } from "@/lib/data-marketplace";

const CATEGORY_COLORS: Record<string, string> = {
  "market-data": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  research: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  regulatory: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  scientific: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "ai-intelligence": "bg-pink-500/10 text-pink-600 border-pink-500/20",
};

const LICENSE_COLORS: Record<string, string> = {
  "CC-BY-4.0": "text-emerald-600",
  "CC-BY-SA-4.0": "text-emerald-600",
  MIT: "text-emerald-600",
  Commercial: "text-amber-600",
};

function cidShort(cid: string) {
  return cid.slice(0, 14) + "…" + cid.slice(-8);
}

function addrShort(addr: string) {
  return addr.slice(0, 8) + "…" + addr.slice(-4);
}

export function DataListingCard({ listing }: { listing: DataListing }) {
  const [showModal, setShowModal] = useState(false);

  const priceRaw = BigInt(listing.priceUsdc);
  const priceDisplay = `$${formatUnits(priceRaw, 6)}`;

  const categoryStyle =
    CATEGORY_COLORS[listing.category] ??
    "bg-muted text-muted-foreground border-border";

  const ipfsGateway = listing.contentCid.startsWith("baf")
    ? `https://ipfs.io/ipfs/${listing.contentCid}`
    : null;

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
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
            <span
              className={cn(
                "text-[11px] font-medium",
                LICENSE_COLORS[listing.license] ?? "text-muted-foreground"
              )}
            >
              {listing.license}
            </span>
          </div>
          <span className="text-lg font-bold tabular-nums shrink-0">{priceDisplay}</span>
        </div>

        {/* CID */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Content CID
          </p>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-foreground">{cidShort(listing.contentCid)}</span>
            {ipfsGateway && (
              <a
                href={ipfsGateway}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                title="View on IPFS"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Producer + listing ID */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Produced by:{" "}
            <a
              href={`/agents/filecoinCalibration/${listing.agentId}`}
              className="font-medium text-primary hover:underline"
            >
              Agent #{listing.agentId}
            </a>
          </span>
          <span>#{listing.id}</span>
        </div>

        {/* Purchase button */}
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() => setShowModal(true)}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Purchase · {priceDisplay} USDC
        </Button>
      </div>

      {showModal && (
        <PurchaseListingModal listing={listing} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
