import { NextResponse } from "next/server";
import { getAgentsPage } from "@/lib/agents";
import { fetchDataListings, DATA_LISTING_REGISTRY_ADDRESS, DATA_ESCROW_ADDRESS, USDC_ADDRESS } from "@/lib/data-marketplace";
import { NETWORKS, NETWORK_IDS } from "@/lib/networks";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sepolia, filecoin, artifacts] = await Promise.allSettled([
    getAgentsPage({ network: "sepolia", pageSize: 1 }),
    getAgentsPage({ network: "filecoinCalibration", pageSize: 1 }),
    fetchDataListings(),
  ]);

  return NextResponse.json({
    agents: {
      sepolia: sepolia.status === "fulfilled" ? sepolia.value.total : 0,
      filecoinCalibration: filecoin.status === "fulfilled" ? filecoin.value.total : 0,
    },
    dataListings: artifacts.status === "fulfilled" ? artifacts.value.total : 0,
    networks: NETWORK_IDS.map((id) => ({
      id,
      name: NETWORKS[id].name,
      chainId: NETWORKS[id].chain.id,
      identityRegistry: NETWORKS[id].identityRegistry,
    })),
    contracts: {
      DataListingRegistry: DATA_LISTING_REGISTRY_ADDRESS,
      DataEscrow: DATA_ESCROW_ADDRESS,
      USDC: USDC_ADDRESS,
    },
    mcpServer: "/api/mcp",
    agentCard: "/.well-known/agent-card.json",
  });
}
