import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchAgentById } from "@/lib/registry";
import type { NetworkId } from "@/lib/networks";
import { DEFAULT_NETWORK, NETWORK_IDS } from "@/lib/networks";

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

  const getCachedAgent = unstable_cache(
    () => fetchAgentById(id, network),
    ["agent-detail", id, network],
    { revalidate: 60, tags: ["agent-detail", `agent-${id}`, `agent-${id}-${network}`] }
  );

  try {
    const agent = await getCachedAgent();
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error("[Agent API]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
