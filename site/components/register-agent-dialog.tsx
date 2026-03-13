"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AgentVerificationPanel } from "@/components/agent-verification-panel";
import { IDENTITY_REGISTRY_ABI } from "@/lib/identity-registry-abi";
import { NETWORKS, DEFAULT_NETWORK, type NetworkId } from "@/lib/networks";
import type { AgentCard, ParsedServices } from "@/lib/agent-validator";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ValidationState {
  valid: boolean;
  agentCard: AgentCard | null;
  parsedServices: ParsedServices | null;
  health: boolean;
  errors: string[];
}

interface CustomEndpoint {
  id: string;
  name: string;
  url: string;
}

interface EndpointsState {
  health: { enabled: boolean; url: string };
  mcp: { enabled: boolean; url: string; tools: string };
  a2a: { enabled: boolean; url: string; skills: string };
  x402: { enabled: boolean; url: string };
}

const TX_EXPLORER_BASE: Record<NetworkId, string> = {
  sepolia: "https://sepolia.etherscan.io/tx/",
  filecoinCalibration: "https://calibration.filscan.io/tx/",
  baseSepolia: "https://sepolia.basescan.org/tx/",
};

// ── Network card ─────────────────────────────────────────────────────────────

function NetworkCard({
  networkId,
  selected,
  onSelect,
}: {
  networkId: NetworkId;
  selected: boolean;
  onSelect: () => void;
}) {
  const n = NETWORKS[networkId];
  const isFilecoin = networkId === "filecoinCalibration";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-1 flex-col gap-2 rounded-lg border p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg">{isFilecoin ? "🌐" : "⟠"}</span>
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      <div>
        <p className="font-semibold text-sm">{n.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          {n.identityRegistry.slice(0, 10)}…
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{n.explorerName}</p>
    </button>
  );
}

// ── Endpoint toggle row ───────────────────────────────────────────────────────

interface EndpointRowProps {
  icon: string;
  label: string;
  description: string;
  badge?: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function EndpointRow({
  icon,
  label,
  description,
  badge,
  enabled,
  onToggle,
  children,
}: EndpointRowProps) {
  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        enabled ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-lg shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {badge && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </div>
      </button>
      {enabled && children && (
        <div className="border-t border-primary/20 px-4 pb-4 pt-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

interface RegisterAgentDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RegisterAgentDialog({
  trigger,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: RegisterAgentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (isControlled) {
        controlledOnOpenChange?.(v);
      } else {
        setInternalOpen(v);
      }
    },
    [isControlled, controlledOnOpenChange]
  );

  const [selectedNetworkId, setSelectedNetworkId] = useState<NetworkId>(DEFAULT_NETWORK);
  const [endpoints, setEndpoints] = useState<EndpointsState>({
    health: { enabled: false, url: "" },
    mcp: { enabled: false, url: "", tools: "" },
    a2a: { enabled: false, url: "", skills: "" },
    x402: { enabled: false, url: "" },
  });
  const [customEndpoints, setCustomEndpoints] = useState<CustomEndpoint[]>([]);
  const [endpointsSectionOpen, setEndpointsSectionOpen] = useState(true);
  const [agentCardUrl, setAgentCardUrl] = useState("");
  const [healthUrl, setHealthUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContract, isPending: isWriting, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const networkConfig = NETWORKS[selectedNetworkId];

  function toggleEndpoint(key: keyof EndpointsState) {
    setEndpoints((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  }

  function setEndpointField<K extends keyof EndpointsState>(
    key: K,
    field: keyof EndpointsState[K],
    value: string
  ) {
    setEndpoints((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  function addCustomEndpoint() {
    setCustomEndpoints((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", url: "" },
    ]);
  }

  function removeCustomEndpoint(id: string) {
    setCustomEndpoints((prev) => prev.filter((e) => e.id !== id));
  }

  function updateCustomEndpoint(id: string, field: "name" | "url", value: string) {
    setCustomEndpoints((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  async function handleVerify() {
    if (!agentCardUrl.trim()) return;
    setValidating(true);
    setValidation(null);
    try {
      const res = await fetch("/api/agents/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentCardUrl: agentCardUrl.trim(),
          healthUrl: healthUrl.trim() || endpoints.health.url.trim() || undefined,
        }),
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

  function handleRegister() {
    if (!agentCardUrl.trim()) return;
    writeContract(
      {
        address: networkConfig.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "register",
        args: [agentCardUrl.trim()],
        chainId: networkConfig.chain.id,
      },
      {
        onSuccess(hash) {
          setTxHash(hash);
        },
      }
    );
  }

  const canRegister = validation?.valid === true && !isWriting && !isConfirming;
  const activeEndpointCount =
    Object.values(endpoints).filter((e) => e.enabled).length + customEndpoints.length;

  function handleClose() {
    setOpen(false);
    if (isConfirmed) {
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="rounded-full">
            Register Agent
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        showCloseButton={!isConfirmed}
      >
        {isConfirmed && txHash ? (
          <div className="p-6">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="pt-6 space-y-3 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <h2 className="font-semibold text-lg">Registration submitted!</h2>
                <p className="text-sm text-muted-foreground">
                  Your agent will appear in the directory once indexed on{" "}
                  <span className="font-medium text-foreground">{networkConfig.name}</span>.
                </p>
                <div className="flex justify-center gap-3">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`${TX_EXPLORER_BASE[selectedNetworkId]}${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on {networkConfig.explorerName}
                    </a>
                  </Button>
                  <Button size="sm" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <DialogTitle>Register Agent</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Register your ERC-8004 agent on-chain. The agent card URL is stored on-chain.
              </p>
            </DialogHeader>
            <div className="px-6 py-6 space-y-6 overflow-y-auto">
              {/* Step 1: Network */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      1
                    </span>
                    <h2 className="font-semibold text-sm">Select network</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    {(Object.keys(NETWORKS) as NetworkId[]).map((id) => (
                      <NetworkCard
                        key={id}
                        networkId={id}
                        selected={selectedNetworkId === id}
                        onSelect={() => setSelectedNetworkId(id)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: Endpoints */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between"
                    onClick={() => setEndpointsSectionOpen((v) => !v)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        2
                      </span>
                      <h2 className="font-semibold text-sm">Configure endpoints</h2>
                      {activeEndpointCount > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {activeEndpointCount} active
                        </span>
                      )}
                    </div>
                    {endpointsSectionOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CardHeader>
                {endpointsSectionOpen && (
                  <CardContent className="space-y-2.5">
                    <EndpointRow
                      icon="💗"
                      label="Health Check"
                      description="Liveness endpoint returning { status: 'ok' }"
                      enabled={endpoints.health.enabled}
                      onToggle={() => toggleEndpoint("health")}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">URL</Label>
                        <Input
                          placeholder="https://your-agent.vercel.app/api/health"
                          value={endpoints.health.url}
                          onChange={(e) => setEndpointField("health", "url", e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </EndpointRow>
                    <EndpointRow
                      icon="🔌"
                      label="MCP"
                      badge="Model Context Protocol"
                      description="Exposes tools consumable by MCP-compatible agents"
                      enabled={endpoints.mcp.enabled}
                      onToggle={() => toggleEndpoint("mcp")}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Endpoint URL</Label>
                        <Input
                          placeholder="https://your-agent.vercel.app/mcp"
                          value={endpoints.mcp.url}
                          onChange={(e) => setEndpointField("mcp", "url", e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </EndpointRow>
                    <EndpointRow
                      icon="🔄"
                      label="A2A"
                      badge="Agent-to-Agent"
                      description="Agent-to-Agent protocol"
                      enabled={endpoints.a2a.enabled}
                      onToggle={() => toggleEndpoint("a2a")}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Endpoint URL</Label>
                        <Input
                          placeholder="https://your-agent.vercel.app/a2a"
                          value={endpoints.a2a.url}
                          onChange={(e) => setEndpointField("a2a", "url", e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </EndpointRow>
                    <EndpointRow
                      icon="💳"
                      label="x402 Payment"
                      badge="ERC-8004"
                      description="Paid service endpoint"
                      enabled={endpoints.x402.enabled}
                      onToggle={() => toggleEndpoint("x402")}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Service URL</Label>
                        <Input
                          placeholder="https://your-agent.vercel.app/api/run"
                          value={endpoints.x402.url}
                          onChange={(e) => setEndpointField("x402", "url", e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </EndpointRow>
                    {customEndpoints.map((ep) => (
                      <div
                        key={ep.id}
                        className="rounded-lg border border-dashed border-border p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Custom endpoint
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCustomEndpoint(ep.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input
                              placeholder="e.g. webhook"
                              value={ep.name}
                              onChange={(e) => updateCustomEndpoint(ep.id, "name", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">URL</Label>
                            <Input
                              placeholder="https://..."
                              value={ep.url}
                              onChange={(e) => updateCustomEndpoint(ep.id, "url", e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs border-dashed"
                      onClick={addCustomEndpoint}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add custom endpoint
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* Step 3: Verify */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      3
                    </span>
                    <h2 className="font-semibold text-sm">Enter agent URLs</h2>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="agentCardUrl">Agent Card URL</Label>
                    <Input
                      id="agentCardUrl"
                      placeholder="https://your-agent.vercel.app/api/agent-card"
                      value={agentCardUrl}
                      onChange={(e) => {
                        setAgentCardUrl(e.target.value);
                        setValidation(null);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="healthUrl">
                      Health URL{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="healthUrl"
                      placeholder={endpoints.health.url || "https://your-agent.vercel.app/api/health"}
                      value={healthUrl}
                      onChange={(e) => {
                        setHealthUrl(e.target.value);
                        setValidation(null);
                      }}
                    />
                  </div>
                  <Button
                    onClick={handleVerify}
                    disabled={!agentCardUrl.trim() || validating}
                    variant="outline"
                    className="w-full"
                  >
                    {validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {validating ? "Verifying…" : "Verify Agent"}
                  </Button>
                </CardContent>
              </Card>

              {validation && (
                <AgentVerificationPanel
                  agentCard={validation.agentCard}
                  parsedServices={validation.parsedServices}
                  health={validation.health}
                  errors={validation.errors}
                />
              )}

              {validation && (
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        4
                      </span>
                      <h2 className="font-semibold text-sm">Register on-chain</h2>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleRegister}
                      disabled={!canRegister}
                      className="w-full"
                    >
                      {isWriting || isConfirming ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isConfirming ? "Confirming…" : "Waiting for wallet…"}
                        </>
                      ) : (
                        `Register on ${networkConfig.name}`
                      )}
                    </Button>
                    {writeError && (
                      <p className="mt-2 text-xs text-red-600">
                        {writeError.message?.split("\n")[0]}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
