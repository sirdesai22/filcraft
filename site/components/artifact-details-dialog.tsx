"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, ShoppingCart } from "lucide-react";
import { PurchaseListingModal } from "@/components/purchase-listing-modal";
import type { DataListing } from "@/lib/data-marketplace";

const CATEGORY_LABELS: Record<string, string> = {
  "market-data": "Market Data",
  research: "Research",
  regulatory: "Regulatory",
  scientific: "Scientific",
  "ai-intelligence": "AI Intelligence",
};

function formatDate(timestamp: string) {
  const ts = Number(timestamp);
  if (!ts || isNaN(ts)) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ArtifactDetailsDialogProps {
  listing: DataListing | null;
  agentName?: string;
  runSummary?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtifactDetailsDialog({
  listing,
  agentName,
  runSummary,
  open,
  onOpenChange,
}: ArtifactDetailsDialogProps) {
  const [showPurchase, setShowPurchase] = useState(false);

  useEffect(() => {
    if (!open) setShowPurchase(false);
  }, [open]);

  if (!listing) return null;

  const priceDisplay = `$${formatUnits(BigInt(listing.priceUsdc), 6)}`;
  const categoryLabel = CATEGORY_LABELS[listing.category] ?? listing.category;
  const ipfsUrl = listing.contentCid.startsWith("baf")
    ? `https://ipfs.io/ipfs/${listing.contentCid}`
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Artifact Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            {/* Agent & Run */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Produced by</span>
                <Link
                  href={`/agents/filecoinCalibration/${listing.agentId}`}
                  className="font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {agentName ?? `Agent #${listing.agentId}`}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Listed</span>
                <span>{formatDate(listing.createdAt)}</span>
              </div>
              {runSummary && (
                <div>
                  <span className="text-muted-foreground block mb-1">About</span>
                  <p className="text-foreground leading-snug">{runSummary}</p>
                </div>
              )}
            </div>

            {/* Category & License */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                {categoryLabel}
              </span>
              <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                {listing.license || "—"}
              </span>
            </div>

            {/* Content CID */}
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Content CID</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs break-all bg-muted/50 px-2 py-1 rounded">
                  {listing.contentCid}
                </code>
                {ipfsUrl && (
                  <a
                    href={ipfsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    title="View on IPFS"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
              <span className="text-muted-foreground">Price</span>
              <span className="text-xl font-bold tabular-nums">{priceDisplay} USDC</span>
            </div>

            {/* Purchase */}
            <p className="text-xs text-muted-foreground">
              Purchase locks USDC in escrow. Funds release to the agent after you verify the CID
              or auto-settle after 48 hours.
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => {
                setShowPurchase(true);
                onOpenChange(false);
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              Purchase for {priceDisplay} USDC
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showPurchase && (
        <PurchaseListingModal
          listing={listing}
          onClose={() => setShowPurchase(false)}
        />
      )}
    </>
  );
}
