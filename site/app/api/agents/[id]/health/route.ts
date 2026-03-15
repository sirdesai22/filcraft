import { NextRequest, NextResponse } from "next/server";
import { fetchAgentById } from "@/lib/registry";
import type { NetworkId } from "@/lib/networks";
import { DEFAULT_NETWORK, NETWORK_IDS } from "@/lib/networks";

// GET /api/agents/[id]/health?network=sepolia
// Returns live health status. Both the agent lookup and the remote health
// fetch are optional — missing or failing either returns status: "unknown".
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

  // Agent lookup is best-effort — failure is not fatal
  let healthUrl: string | undefined;
  try {
    const agent = await fetchAgentById(id, network);
    healthUrl = agent?.metadata?.healthUrl;
  } catch {
    console.warn(`[health] Could not fetch agent ${id} on ${network}`);
  }

  if (!healthUrl) {
    return NextResponse.json({
      agentId: id,
      status: "unknown",
      warning: "Agent has no healthUrl in metadata",
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
        status: "unknown",
        warning: `Health endpoint returned HTTP ${res.status}`,
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    }

    const body = await res.json().catch(() => ({}));
    const status = (body?.status === "ok" || body?.ok === true) ? "ok" : "unknown";

    return NextResponse.json({
      agentId: id,
      status,
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const warning = e instanceof Error ? e.message : "Health fetch failed";
    console.warn(`[health] ${id}: ${warning}`);
    return NextResponse.json({
      agentId: id,
      status: "unknown",
      warning,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  }
}
