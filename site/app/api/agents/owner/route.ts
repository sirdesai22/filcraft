import { NextRequest, NextResponse } from "next/server";
import { NETWORKS, type NetworkId } from "@/lib/networks";
import { fetchOwnerFromGoldskySubgraph } from "@/lib/subgraph";

// GET /api/agents/owner?network=filecoinCalibration&agentId=13
// Returns { owner: string } for networks with Goldsky subgraph (Filecoin Calibration)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get("network") as NetworkId | null;
  const agentId = searchParams.get("agentId");

  if (!network || !agentId) {
    return NextResponse.json(
      { error: "network and agentId are required" },
      { status: 400 }
    );
  }

  const config = NETWORKS[network];
  if (!config) {
    return NextResponse.json({ error: "Unknown network" }, { status: 400 });
  }

  if (!config.subgraphUrl) {
    return NextResponse.json(
      { error: "Network does not have subgraph (use RPC)" },
      { status: 400 }
    );
  }

  // Filecoin Calibration uses Goldsky; Sepolia uses The Graph (different schema)
  if (network === "filecoinCalibration") {
    try {
      const owner = await fetchOwnerFromGoldskySubgraph(
        config.subgraphUrl,
        agentId
      );
      if (!owner) {
        return NextResponse.json(
          { error: "Agent not found", owner: null },
          { status: 404 }
        );
      }
      return NextResponse.json({ owner });
    } catch (e) {
      console.error("[api/agents/owner] Goldsky error:", e);
      return NextResponse.json(
        {
          error: e instanceof Error ? e.message : "Subgraph error",
          owner: null,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Use RPC for this network", owner: null },
    { status: 400 }
  );
}
