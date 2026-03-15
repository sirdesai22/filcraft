import { NextResponse } from "next/server";
import { NETWORKS } from "@/lib/networks";
import {
  DATA_LISTING_REGISTRY_ADDRESS,
  DATA_ESCROW_ADDRESS,
  USDC_ADDRESS,
} from "@/lib/data-marketplace";

// ERC-8004 agent card for the FilCraft platform itself
export async function GET() {
  const card = {
    schema: "erc8004-v1",
    name: "FilCraft Agent Economy",
    description:
      "Agent-native marketplace for the Filecoin + Ethereum agent economy. " +
      "Discover ERC-8004 agents, check credit scores, buy data artifacts, " +
      "and invoke x402 services — all programmable via MCP.",
    version: "1.0.0",
    url: "https://memfil.io",
    active: true,
    x402Support: false,
    mcpEndpoint: "https://memfil.io/api/mcp",
    mcpTools: [
      "discover_agents",
      "get_agent",
      "get_credit_score",
      "list_artifacts",
      "get_artifact",
      "platform_stats",
      "get_onboarding",
      "invoke_agent_guide",
    ],
    healthUrl: "https://memfil.io/api/health",
    supportedTrusts: ["ERC-8004", "x402", "ERC-20"],
    contracts: {
      identityRegistries: {
        sepolia: NETWORKS.sepolia.identityRegistry,
        filecoinCalibration: NETWORKS.filecoinCalibration.identityRegistry,
      },
      reputationRegistries: {
        sepolia: NETWORKS.sepolia.reputationRegistry,
        filecoinCalibration: NETWORKS.filecoinCalibration.reputationRegistry,
      },
      dataMarketplace: {
        DataListingRegistry: DATA_LISTING_REGISTRY_ADDRESS,
        DataEscrow: DATA_ESCROW_ADDRESS,
        USDC: USDC_ADDRESS,
        network: "filecoinCalibration",
      },
    },
    apis: [
      { path: "/api/mcp",                  method: "POST", description: "MCP server — full platform as tools" },
      { path: "/api/agents",               method: "GET",  description: "List/search ERC-8004 agents" },
      { path: "/api/agents/:id",           method: "GET",  description: "Agent detail + invocation guide" },
      { path: "/api/agents/:id/health",    method: "GET",  description: "Agent health check" },
      { path: "/api/agents/:id/score",     method: "GET",  description: "Credit score for agent" },
      { path: "/api/data-listings",        method: "GET",  description: "List data artifact listings" },
      { path: "/api/data-listings/:id",    method: "GET",  description: "Single listing detail" },
      { path: "/api/stats",                method: "GET",  description: "Platform statistics" },
      { path: "/api/health",               method: "GET",  description: "Platform health" },
      { path: "/api/agents/validate",      method: "POST", description: "Validate an agent card" },
    ],
  };

  return NextResponse.json(card, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
