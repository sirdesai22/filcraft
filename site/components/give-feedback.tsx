"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract } from "wagmi";
import { keccak256, toHex } from "viem";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Loader2 } from "lucide-react";
import { REPUTATION_REGISTRY_ABI } from "@/lib/reputation-abi";
import { getNetwork, type NetworkId } from "@/lib/networks";

const TAG1_OPTIONS = ["starred", "quality", "speed", "reliability", "helpfulness"];

interface GiveFeedbackProps {
  agentId: string;
  networkId: NetworkId;
  onSuccess?: () => void;
}

export function GiveFeedback({ agentId, networkId, onSuccess }: GiveFeedbackProps) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(85);
  const [tag1, setTag1] = useState("starred");
  const [tag2, setTag2] = useState("");
  const [feedbackText, setFeedbackText] = useState("");

  const network = getNetwork(networkId);
  const chainId = network.chain.id;

  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const {
    writeContract,
    isPending: isSubmitting,
    isSuccess,
    isError,
    error,
    reset,
  } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        onSuccess?.();
      },
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    setOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      connect({ connector: connectors[0] });
      return;
    }
    if (chain?.id !== chainId) {
      await switchChainAsync({ chainId });
      return;
    }

    const agentIdBigInt = BigInt(agentId);
    const value = BigInt(Math.min(100, Math.max(0, score)));
    const valueDecimals = 0;
    const feedbackHash = feedbackText
      ? (keccak256(toHex(feedbackText)) as `0x${string}`)
      : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`);

    writeContract({
      address: network.reputationRegistry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "giveFeedback",
      args: [
        agentIdBigInt,
        value,
        valueDecimals,
        tag1,
        tag2 || "",
        "",
        "",
        feedbackHash,
      ],
    });
  };

  const isWrongChain = isConnected && chain?.id !== chainId;
  const needsConnect = !isConnected;
  const canSubmit = isConnected && chain?.id === chainId && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Give feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give feedback</DialogTitle>
          <DialogDescription>
            Submit on-chain feedback for this agent. You must use a wallet that is not the agent
            owner or operator.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {needsConnect && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">Connect wallet</p>
              <p className="mt-1 text-muted-foreground">
                Connect your wallet to submit feedback on {network.name}.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => connect({ connector: connectors[0] })}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  "Connect wallet"
                )}
              </Button>
            </div>
          )}

          {isWrongChain && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">Wrong network</p>
              <p className="mt-1 text-muted-foreground">
                Switch to {network.name} to submit feedback.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => switchChainAsync({ chainId })}
                disabled={isSwitching}
              >
                {isSwitching ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Switching…
                  </>
                ) : (
                  `Switch to ${network.name}`
                )}
              </Button>
            </div>
          )}

          {isConnected && chain?.id === chainId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="score">Score (0–100)</Label>
                <Input
                  id="score"
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag1">Category</Label>
                <select
                  id="tag1"
                  value={tag1}
                  onChange={(e) => setTag1(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  {TAG1_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag2">Subcategory (optional)</Label>
                <Input
                  id="tag2"
                  placeholder="e.g. service"
                  value={tag2}
                  onChange={(e) => setTag2(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback">Comment (optional, hashed on-chain)</Label>
                <Input
                  id="feedback"
                  placeholder="Optional text feedback"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
              </div>
            </>
          )}

          {isError && (
            <div className="max-h-24 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="break-words text-sm text-destructive">
                {error?.message?.includes("Self-feedback not allowed")
                  ? "You cannot give feedback to your own agent."
                  : error?.message?.includes("User rejected the request")
                    ? "Transaction was rejected in your wallet."
                    : error?.message ?? "Transaction failed."}
              </p>
            </div>
          )}

          {isSuccess && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Feedback submitted!</p>
          )}

          <DialogFooter>
            {isConnected && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => disconnect()}
              >
                Disconnect
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || isConnecting || isSwitching}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Submitting…
                </>
              ) : needsConnect ? (
                "Connect to continue"
              ) : isWrongChain ? (
                "Switch network to continue"
              ) : (
                "Submit feedback"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
