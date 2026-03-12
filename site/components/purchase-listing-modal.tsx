"use client";

import { useState } from "react";
import { useAccount, useConnect, useWriteContract, useSwitchChain } from "wagmi";
import { filecoinCalibration } from "viem/chains";
import { formatUnits, parseAbi } from "viem";
import { ExternalLink, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DATA_ESCROW_ADDRESS,
  MOCK_USDC_ADDRESS,
  ESCROW_ABI,
  ERC20_ABI,
  PLATFORM_FEE_BPS,
  type DataListing,
} from "@/lib/data-marketplace";

type Step = "idle" | "approve" | "purchase" | "done" | "error";

function truncate(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

interface PurchaseListingModalProps {
  listing: DataListing;
  onClose: () => void;
}

export function PurchaseListingModal({ listing, onClose }: PurchaseListingModalProps) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("idle");
  const [approveTx, setApproveTx] = useState<string | null>(null);
  const [purchaseTx, setPurchaseTx] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const priceRaw = BigInt(listing.priceUsdc);
  const feeRaw = (priceRaw * BigInt(PLATFORM_FEE_BPS)) / 10000n;
  const sellerAmountRaw = priceRaw - feeRaw;

  const isWrongNetwork = isConnected && chain?.id !== filecoinCalibration.id;

  async function handlePurchase() {
    if (!address) return;
    setStep("approve");
    setErrorMsg(null);

    try {
      // Step 1: Approve USDC
      const approveTxHash = await writeContractAsync({
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [DATA_ESCROW_ADDRESS, priceRaw],
        chainId: filecoinCalibration.id,
      });
      setApproveTx(approveTxHash);

      // Step 2: Purchase
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
      setErrorMsg(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      setStep("error");
    }
  }

  async function handleMintUsdc() {
    if (!address) return;
    try {
      await writeContractAsync({
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, priceRaw * 100n], // mint 100x buffer
        chainId: filecoinCalibration.id,
      });
    } catch {
      // ignore
    }
  }

  const txUrl = (hash: string) =>
    `https://calibration.filscan.io/tx/${hash}`;

  const cidShort = listing.contentCid.slice(0, 20) + "…";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg mx-4">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold mb-1">Purchase Listing #{listing.id}</h2>
        <p className="text-sm text-muted-foreground mb-5">
          {listing.category} · {listing.license}
        </p>

        {/* Listing details */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm mb-5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Content CID</span>
            <span className="font-mono text-foreground">{cidShort}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price</span>
            <span className="font-medium">${formatUnits(priceRaw, 6)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform fee (2.5%)</span>
            <span>${formatUnits(feeRaw, 6)} USDC</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">Seller receives</span>
            <span className="font-medium text-emerald-600">${formatUnits(sellerAmountRaw, 6)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network</span>
            <span>Filecoin Calibration</span>
          </div>
        </div>

        {/* Not connected */}
        {!isConnected && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Connect your wallet to purchase.</p>
            {connectors.map((c) => (
              <Button key={c.id} className="w-full" onClick={() => connect({ connector: c })}>
                Connect {c.name}
              </Button>
            ))}
          </div>
        )}

        {/* Wrong network */}
        {isConnected && isWrongNetwork && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Switch to Filecoin Calibration to continue.
            </div>
            <Button
              className="w-full"
              onClick={() => switchChain({ chainId: filecoinCalibration.id })}
            >
              Switch Network
            </Button>
          </div>
        )}

        {/* Connected + correct network */}
        {isConnected && !isWrongNetwork && step === "idle" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Connected: {truncate(address!)}
              <br />
              Using MockUSDC (testnet). Need USDC?{" "}
              <button
                onClick={handleMintUsdc}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Mint test USDC
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              Two transactions: approve USDC allowance, then lock in escrow.
              Seller receives funds after you confirm delivery.
            </p>
            <Button className="w-full" onClick={handlePurchase}>
              Purchase for ${formatUnits(priceRaw, 6)} USDC
            </Button>
          </div>
        )}

        {/* Approve in progress */}
        {step === "approve" && (
          <div className="flex items-center gap-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>Step 1/2 — Approving USDC…</span>
          </div>
        )}

        {/* Purchase in progress */}
        {step === "purchase" && (
          <div className="space-y-3">
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
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Step 2/2 — Locking in escrow…</span>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Purchase confirmed
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
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Content CID</p>
              <p className="font-mono break-all">{listing.contentCid}</p>
              <p className="pt-1">
                Verify via IPFS gateway or any Filecoin node. Funds locked in escrow
                until you confirm delivery (or auto-settle after 48h).
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {errorMsg ?? "Transaction failed."}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep("idle")}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
