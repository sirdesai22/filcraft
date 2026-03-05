import { NextRequest, NextResponse } from "next/server";
import { fetchAgentById } from "@/lib/registry";
import type { NetworkId } from "@/lib/networks";
import { DEFAULT_NETWORK, NETWORK_IDS } from "@/lib/networks";

// GET /api/agents/[id]/health?network=sepolia
// Proxies to the agent's healthUrl from its metadata and returns live status.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const networkParam =
    request.nextUrl.searchParams.get("network") || DEFAULT_NETWORK;
  const network: NetworkId = NETWORK_IDS.includes(networkParam as NetworkId)
    ? (networkParam as NetworkId)
    : DEFAULT_NETWORK;

  const agent = await fetchAgentById(id, network);
  if (!agent) {
    return NextResponse.json(
      { agentId: id, status: "unreachable", error: "Agent not found" },
      { status: 404 }
    );
  }

  const healthUrl = agent.metadata?.healthUrl;
  if (!healthUrl) {
    return NextResponse.json({
      agentId: id,
      status: "unknown",
      error: "Agent has no healthUrl in metadata",
      timestamp: new Date().toISOString(),
    });
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return NextResponse.json({
        agentId: id,
        status: "unreachable",
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    }

    const body = await res.json();
    const status = body?.status === "ok" ? "ok" : "unreachable";

    return NextResponse.json({
      agentId: id,
      status,
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      agentId: id,
      status: "unreachable",
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  }
}
