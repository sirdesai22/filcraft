"use client";

import { useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { filecoinCalibration } from "viem/chains";
import { useAccount, useConnect, useWriteContract, useSwitchChain } from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Loader2,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import type { DataListing } from "@/lib/data-marketplace";
import {
  DATA_ESCROW_ADDRESS,
  USDC_ADDRESS,
  ESCROW_ABI,
  ERC20_ABI,
  PLATFORM_FEE_BPS,
} from "@/lib/data-marketplace";

type Step = "info" | "approve" | "purchase" | "done" | "error";

function filbeamUrl(cid: string) {
  return `https://calib.ezpdpz.net/piece/${cid}`;
}

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

function truncate(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
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
  const [step, setStep] = useState<Step>("info");
  const [approveTx, setApproveTx] = useState<string | null>(null);
  const [purchaseTx, setPurchaseTx] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  if (!listing) return null;

  const priceRaw = BigInt(listing.priceUsdc);
  const priceDisplay = `$${formatUnits(priceRaw, 6)}`;
  const isWrongNetwork = isConnected && chain?.id !== filecoinCalibration.id;

  function handleClose(open: boolean) {
    if (!open) {
      if (step !== "approve" && step !== "purchase") {
        setStep("info");
        setApproveTx(null);
        setPurchaseTx(null);
        setErrorMsg(null);
      }
    }
    onOpenChange(open);
  }

  async function handlePurchase() {
    if (!address) return;
    setErrorMsg(null);
    setStep("approve");
    try {
      const approveTxHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [DATA_ESCROW_ADDRESS, priceRaw],
        chainId: filecoinCalibration.id,
      });
      setApproveTx(approveTxHash);
      setStep("purchase");
      const purchaseTxHash = await writeContractAsync({
        address: DATA_ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "purchase",
        args: [BigInt(listing.id)],
        chainId: filecoinCalibration.id,
      });
      setPurchaseTx(purchaseTxHash);
      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg.length > 160 ? msg.slice(0, 160) + "…" : msg);
      setStep("error");
    }
  }

  const txUrl = (hash: string) => `https://calibration.filscan.io/tx/${hash}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "done" ? "Purchase Complete" : "Data Artifact"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {/* Agent & Run — always visible */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Produced by</span>
              <Link
                href={`/economy?agent=${listing.agentId}&network=filecoinCalibration`}
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

          {/* ── Info step ────────────────────────────────────────────── */}
          {step === "info" && (
            <>
              {/* CID locked */}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 text-muted-foreground text-xs">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Retrieval URL revealed after purchase
              </div>

              {/* Price */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <span className="text-muted-foreground">Price</span>
                <span className="text-xl font-bold tabular-nums">{priceDisplay} USDC</span>
              </div>

              {/* Wallet states */}
              {!isConnected && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Connect your wallet to purchase.</p>
                  {connectors.map((c) => (
                    <Button key={c.id} className="w-full" onClick={() => connect({ connector: c })}>
                      Connect {c.name}
                    </Button>
                  ))}
                </div>
              )}

              {isConnected && isWrongNetwork && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Switch to Filecoin Calibration to continue.
                  </div>
                  <Button className="w-full" onClick={() => switchChain({ chainId: filecoinCalibration.id })}>
                    Switch Network
                  </Button>
                </div>
              )}

              {isConnected && !isWrongNetwork && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Connected: {truncate(address!)} · Two txs: approve USDC, then lock in escrow.
                    Seller receives funds after delivery confirmed (or auto-settle 48h).
                  </p>
                  <Button className="w-full gap-2" onClick={handlePurchase}>
                    <ShoppingCart className="h-4 w-4" />
                    Purchase for {priceDisplay} USDC
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Approve step ─────────────────────────────────────────── */}
          {step === "approve" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
                <span>Step 1/2 — Approving USDC allowance…</span>
              </div>
              <p className="text-xs text-muted-foreground">Confirm the approval transaction in your wallet.</p>
            </div>
          )}

          {/* ── Purchase step ────────────────────────────────────────── */}
          {step === "purchase" && (
            <div className="space-y-4 py-2">
              {approveTx && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  USDC approved
                  <a href={txUrl(approveTx)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
                <span>Step 2/2 — Locking payment in escrow…</span>
              </div>
              <p className="text-xs text-muted-foreground">Confirm the purchase transaction in your wallet.</p>
            </div>
          )}

          {/* ── Done step ────────────────────────────────────────────── */}
          {step === "done" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Payment locked in escrow · seller receives after delivery
              </div>
              {purchaseTx && (
                <a
                  href={txUrl(purchaseTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  View on Filscan <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {/* Retrieval URL revealed */}
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Filecoin Retrieval URL
                </p>
                <a
                  href={filbeamUrl(listing.contentCid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs break-all text-emerald-600 hover:text-emerald-500 flex items-start gap-1.5"
                >
                  {filbeamUrl(listing.contentCid)}
                  <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
                </a>
                <p className="text-xs text-muted-foreground pt-1">
                  Served directly from a Filecoin PDP storage provider.
                </p>
              </div>

              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          )}

          {/* ── Error step ───────────────────────────────────────────── */}
          {step === "error" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {errorMsg ?? "Transaction failed."}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setStep("info")}>
                Try again
              </Button>
            </div>
          )}
        </div>
        
      </DialogContent>
    </Dialog>
  );
}
