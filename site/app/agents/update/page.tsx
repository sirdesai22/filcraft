"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
  useSwitchChain,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AgentVerificationPanel } from "@/components/agent-verification-panel";
import { IDENTITY_REGISTRY_ABI } from "@/lib/identity-registry-abi";
import { NETWORKS, NETWORK_IDS, DEFAULT_NETWORK } from "@/lib/networks";
import type { NetworkId } from "@/lib/networks";
import type { AgentCard, ParsedServices } from "@/lib/agent-validator";

interface ValidationState {
  valid: boolean;
  agentCard: AgentCard | null;
  parsedServices: ParsedServices | null;
  health: boolean;
  errors: string[];
}

export default function UpdateAgentPage() {
  return (
    <Suspense>
      <UpdateAgentPageInner />
    </Suspense>
  );
}

function UpdateAgentPageInner() {
  const { address: connectedAddress, chain } = useAccount();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const [networkId, setNetworkId] = useState<NetworkId>(DEFAULT_NETWORK);
  const [agentId, setAgentId] = useState("");
  const [newAgentCardUrl, setNewAgentCardUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [chainSwitchError, setChainSwitchError] = useState<string | null>(null);
  const [goldskyOwner, setGoldskyOwner] = useState<string | null>(null);
  const [goldskyError, setGoldskyError] = useState<string | null>(null);
  const [goldskyLoading, setGoldskyLoading] = useState(false);

  const searchParams = useSearchParams();

  // Pre-fill from query params (e.g. linked from the agent detail page)
  useEffect(() => {
    const idParam = searchParams.get("id");
    const netParam = searchParams.get("network");
    if (idParam) setAgentId(idParam);
    if (netParam && NETWORK_IDS.includes(netParam as NetworkId))
      setNetworkId(netParam as NetworkId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const networkConfig = NETWORKS[networkId];

  const chainId = networkConfig.chain.id;

  const useGoldsky = networkId === "filecoinCalibration";

  // Filecoin Calibration: fetch owner from Goldsky subgraph (RPC is unreliable)
  useEffect(() => {
    if (!useGoldsky || !agentId || isNaN(Number(agentId))) {
      setGoldskyOwner(null);
      setGoldskyError(null);
      return;
    }
    let cancelled = false;
    setGoldskyLoading(true);
    setGoldskyError(null);
    fetch(`/api/agents/owner?network=filecoinCalibration&agentId=${agentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setGoldskyOwner(data.owner ?? null);
          setGoldskyError(data.error ?? null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setGoldskyOwner(null);
          setGoldskyError(e instanceof Error ? e.message : "Failed to fetch owner");
        }
      })
      .finally(() => {
        if (!cancelled) setGoldskyLoading(false);
      });
    return () => { cancelled = true; };
  }, [useGoldsky, agentId]);

  // RPC: Read owner for non-Filecoin networks (Sepolia, Base Sepolia)
  const {
    data: onChainOwnerRpc,
    isError: ownerReadError,
    error: ownerReadErrorDetail,
  } = useReadContract({
    address: networkConfig.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "ownerOf",
    args: agentId ? [BigInt(agentId)] : undefined,
    chainId,
    query: {
      enabled: !!agentId && !isNaN(Number(agentId)) && !useGoldsky,
    },
  });

  const onChainOwner = useGoldsky ? goldskyOwner : (onChainOwnerRpc as string | undefined);
  const ownerReadErrorDisplay = useGoldsky ? goldskyError : (ownerReadError ? ownerReadErrorDetail?.message : null);

  const isOwner =
    connectedAddress &&
    onChainOwner &&
    connectedAddress.toLowerCase() === onChainOwner.toLowerCase();

  const { writeContract, isPending: isWriting, error: writeError } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
      chainId,
    });

  async function handleVerify() {
    if (!newAgentCardUrl.trim()) return;
    setValidating(true);
    setValidation(null);
    try {
      const res = await fetch("/api/agents/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentCardUrl: newAgentCardUrl.trim() }),
      });
      const data = await res.json();
      setValidation({
        valid: data.valid ?? false,
        agentCard: data.agentCard ?? null,
        parsedServices: data.parsedServices ?? null,
        health: data.health ?? false,
        errors: data.errors ?? [],
      });
    } catch {
      setValidation({
        valid: false,
        agentCard: null,
        parsedServices: null,
        health: false,
        errors: ["Network error — could not reach validation API"],
      });
    } finally {
      setValidating(false);
    }
  }

  async function handleUpdate() {
    if (!agentId || !newAgentCardUrl.trim()) return;
    setChainSwitchError(null);
    if (chain?.id !== chainId) {
      try {
        await switchChainAsync({ chainId });
        return;
      } catch (e) {
        setChainSwitchError(
          e instanceof Error ? e.message : "Failed to switch network. Add the chain in your wallet if needed."
        );
        return;
      }
    }
    writeContract(
      {
        address: networkConfig.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "setAgentURI",
        args: [BigInt(agentId), newAgentCardUrl.trim()],
        chainId,
        ...(networkConfig.transactionGasLimit !== undefined && {
          gas: networkConfig.transactionGasLimit,
        }),
      },
      {
        onSuccess(hash) {
          setTxHash(hash);
        },
      }
    );
  }

  const isWrongChain = !!connectedAddress && chain?.id !== chainId;
  const canUpdate =
    !!agentId &&
    validation?.valid === true &&
    isOwner &&
    !isWrongChain &&
    !isWriting &&
    !isConfirming;

  const connectedButNotOwner =
    !!connectedAddress && !!onChainOwner && !isOwner && !!agentId && !isWrongChain;

  const explorerBase = networkConfig.explorerTokenUrl;

  function truncateAddr(addr: string) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  return (
    <div className="container px-4 py-8 md:px-6 max-w-2xl">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Agents
      </Link>

      <div className="mb-8">
        <h1
          className="font-display text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-playfair-display), serif" }}
        >
          Update Agent URI
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Points your registered agent to a new agent card URL on-chain. Only
          the token owner can call{" "}
          <code className="font-mono text-xs">setAgentURI</code>.
        </p>
      </div>

      {isConfirmed && txHash ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-6 space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="font-semibold text-lg">URI updated on-chain!</h2>
            <p className="text-sm text-muted-foreground">
              The subgraph will pick up the{" "}
              <code className="font-mono text-xs">URIUpdated</code> event and
              refresh agent metadata within a few minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {txHash && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`${networkConfig.explorerTxUrl}${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View transaction
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <a
                  href={`${explorerBase}${agentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on {networkConfig.explorerName}
                </a>
              </Button>
              <Button asChild size="sm">
                <Link href={`/agents/${networkId}/${agentId}`}>
                  Agent Page
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Step 1 — Identify the agent */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <h2 className="font-semibold text-sm">
                Step 1 — Identify your agent
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="networkId">Network</Label>
                <select
                  id="networkId"
                  value={networkId}
                  onChange={(e) => {
                    setNetworkId(e.target.value as NetworkId);
                    setValidation(null);
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {NETWORK_IDS.map((id) => (
                    <option key={id} value={id}>
                      {NETWORKS[id].name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agentId">Agent ID</Label>
                <Input
                  id="agentId"
                  placeholder="e.g. 42"
                  value={agentId}
                  onChange={(e) => {
                    setAgentId(e.target.value);
                    setValidation(null);
                  }}
                />
                {agentId && !isNaN(Number(agentId)) && (
                  <>
                    {goldskyLoading && useGoldsky && (
                      <p className="text-xs text-muted-foreground">
                        Fetching owner from indexer…
                      </p>
                    )}
                    {ownerReadErrorDisplay && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Could not fetch owner: {ownerReadErrorDisplay.slice(0, 80)}. Agent may not exist on this network.
                      </p>
                    )}
                    {!ownerReadErrorDisplay && !goldskyLoading && onChainOwner && (
                      <p
                        className={`text-xs ${isOwner ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {isOwner
                          ? `✓ You own agent #${agentId}`
                          : `✗ Owner is ${(onChainOwner as string).slice(0, 10)}… — connect that wallet to update`}
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 2 — New agent card URL */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <h2 className="font-semibold text-sm">
                Step 2 — Enter the new agent card URL
              </h2>
              <p className="text-xs text-muted-foreground">
                This URL will be stored on-chain as the new{" "}
                <code className="font-mono">agentURI</code>. Use the same URL
                to update in-place, or a new URL if you moved deployments.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="newAgentCardUrl">New Agent Card URL</Label>
                <Input
                  id="newAgentCardUrl"
                  placeholder="https://your-agent.vercel.app/api/agent-card"
                  value={newAgentCardUrl}
                  onChange={(e) => {
                    setNewAgentCardUrl(e.target.value);
                    setValidation(null);
                  }}
                />
              </div>
              <Button
                onClick={handleVerify}
                disabled={!newAgentCardUrl.trim() || validating}
                variant="outline"
                className="w-full"
              >
                {validating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {validating ? "Verifying…" : "Verify New Card"}
              </Button>
            </CardContent>
          </Card>

          {/* Verification result */}
          {validation && (
            <AgentVerificationPanel
              agentCard={validation.agentCard}
              parsedServices={validation.parsedServices}
              health={validation.health}
              errors={validation.errors}
            />
          )}

          {/* Step 3 — Submit on-chain */}
          {validation && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <h2 className="font-semibold text-sm">
                  Step 3 — Submit on-chain
                </h2>
                <p className="text-xs text-muted-foreground">
                  Calls{" "}
                  <code className="font-mono">
                    setAgentURI({agentId || "agentId"}, newURI)
                  </code>{" "}
                  on the {networkConfig.name} Identity Registry.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {isWrongChain && (
                  <div
                    className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
                    role="alert"
                  >
                    <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Wrong network
                      </p>
                      <p className="mt-1 text-amber-700 dark:text-amber-300/90">
                        Your wallet is on a different chain. Switch to{" "}
                        <strong>{networkConfig.name}</strong> to update this agent.
                        {networkId === "filecoinCalibration" && (
                          <span className="block mt-1 text-amber-600/90 dark:text-amber-400/80">
                            If your wallet doesn&apos;t have Filecoin Calibration, it will prompt you to add it (chainId 314159).
                          </span>
                        )}
                      </p>
                      {chainSwitchError && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                          {chainSwitchError}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={async () => {
                          setChainSwitchError(null);
                          try {
                            await switchChainAsync({ chainId });
                          } catch (e) {
                            setChainSwitchError(
                              e instanceof Error ? e.message : "Failed to switch network"
                            );
                          }
                        }}
                        disabled={isSwitchingChain}
                      >
                        {isSwitchingChain ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Switching…
                          </>
                        ) : (
                          `Switch to ${networkConfig.name}`
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {connectedButNotOwner && (
                  <div
                    className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
                    role="alert"
                  >
                    <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Connected wallet is not the owner
                      </p>
                      <p className="mt-1 text-amber-700 dark:text-amber-300/90">
                        Your wallet:{" "}
                        <code className="font-mono text-xs">
                          {connectedAddress && truncateAddr(connectedAddress)}
                        </code>
                        {" · "}
                        Owner:{" "}
                        <code className="font-mono text-xs">
                          {onChainOwner && truncateAddr(onChainOwner as string)}
                        </code>
                      </p>
                      <p className="mt-1 text-amber-700/90 dark:text-amber-300/80">
                        Connect the owner wallet to update this agent.
                      </p>
                    </div>
                  </div>
                )}
                {!connectedAddress && (
                  <div
                    className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
                    role="alert"
                  >
                    <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
                    <p className="text-amber-800 dark:text-amber-200">
                      Connect a wallet to enable this step.
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleUpdate}
                  disabled={!canUpdate}
                  className="w-full"
                >
                  {isWriting || isConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isConfirming ? "Confirming…" : "Waiting for wallet…"}
                    </>
                  ) : (
                    "Update Agent URI"
                  )}
                </Button>
                {txHash && (isConfirming || isConfirmed) && (
                  <p className="text-xs text-muted-foreground">
                    <a
                      href={`${networkConfig.explorerTxUrl}${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View transaction on {networkConfig.explorerName} →
                    </a>
                  </p>
                )}
                {writeError && (
                  <p className="mt-2 text-xs text-red-600">
                    {writeError.message?.split("\n")[0]}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
