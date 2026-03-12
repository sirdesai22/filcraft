import { NextRequest, NextResponse } from "next/server";
import { fetchAgentById } from "@/lib/registry";
import { computeCreditScore } from "@/lib/credit-score";
import { DEFAULT_NETWORK, NETWORK_IDS, type NetworkId } from "@/lib/networks";

export const dynamic = "force-dynamic";

// GET /api/agents/[id]/score?network=sepolia
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const networkParam = request.nextUrl.searchParams.get("network") || DEFAULT_NETWORK;
  const network: NetworkId = NETWORK_IDS.includes(networkParam as NetworkId)
    ? (networkParam as NetworkId)
    : DEFAULT_NETWORK;

  const agent = await fetchAgentById(id, network).catch(() => null);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const cs = computeCreditScore(agent);
  return NextResponse.json({
    agentId: id,
    network,
    name: agent.metadata?.name ?? null,
    ...cs,
  });
}
