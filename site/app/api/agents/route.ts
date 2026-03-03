import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAgentsPage } from "@/lib/agents";
import type { ProtocolFilter } from "@/lib/agents";
import type { NetworkId } from "@/lib/networks";
import { DEFAULT_NETWORK, NETWORK_IDS } from "@/lib/networks";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "12", 10);
  const query = searchParams.get("q") || "";
  const protocol = (searchParams.get("protocol") || "all") as ProtocolFilter;
  const networkParam = searchParams.get("network") || DEFAULT_NETWORK;
  const network: NetworkId = NETWORK_IDS.includes(networkParam as NetworkId)
    ? (networkParam as NetworkId)
    : DEFAULT_NETWORK;
  const noCache = searchParams.get("noCache") === "1";
  if (noCache) {
    revalidateTag("registry-agents", "default");
    revalidateTag(`registry-agents-${network}`, "default");
  }

  try {
    const result = await getAgentsPage({
      page,
      pageSize,
      query,
      protocol,
      network,
      noCache,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Agents API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        items: [],
      },
      { status: 500 }
    );
  }
}
