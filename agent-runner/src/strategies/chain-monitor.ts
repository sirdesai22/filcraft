/**
 * chain-monitor strategy — ERC-8004 registry activity digest.
 *
 * Data source: Goldsky subgraph for the IdentityRegistry on Filecoin Calibration.
 *
 * Cadence: every 2 hours
 * Output:  JSON activity report
 * Category: ai-intelligence
 */

import type { ArtifactOutput } from "./market-analyst.js";

const SUBGRAPH_URL =
  process.env.GOLDSKY_SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmmaf9dwcfw7s01zc9s19e8xf/subgraphs/erc8004-identity-registry-filecoin-testnet/1.0.0/gn";

interface SubgraphAgent {
  id: string;
  agentId: string;
  owner: string;
  agentURI: string;
  blockNumber: string;
  blockTimestamp: string;
}

interface SubgraphResponse {
  data?: {
    agentRegistereds?: SubgraphAgent[];
  };
  errors?: unknown[];
}

async function fetchRecentRegistrations(limit = 20): Promise<SubgraphAgent[]> {
  const query = `{
    agentRegistereds(
      first: ${limit}
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      agentId
      owner
      agentURI
      blockNumber
      blockTimestamp
    }
  }`;

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Subgraph fetch failed: ${res.status}`);
  const json = (await res.json()) as SubgraphResponse;
  if (json.errors?.length) throw new Error(`Subgraph errors: ${JSON.stringify(json.errors)}`);
  return json.data?.agentRegistereds ?? [];
}

export async function run(): Promise<ArtifactOutput> {
  const timestamp = new Date().toISOString();

  let registrations: SubgraphAgent[] = [];
  try {
    registrations = await fetchRecentRegistrations(20);
  } catch (e) {
    console.warn("[chain-monitor] subgraph fetch failed:", e);
  }

  const report = {
    generatedAt: timestamp,
    network: "filecoinCalibration",
    chainId: 314159,
    reportType: "erc8004-registry-activity",
    windowDescription: "Last 20 agent registrations",
    totalInWindow: registrations.length,
    registrations: registrations.map((r) => ({
      agentId: r.agentId,
      owner: r.owner,
      agentURI: r.agentURI,
      registeredAtBlock: r.blockNumber,
      registeredAt: new Date(Number(r.blockTimestamp) * 1000).toISOString(),
    })),
    subgraphUrl: SUBGRAPH_URL,
  };

  return {
    content: JSON.stringify(report, null, 2),
    mimeType: "application/json",
    listing: {
      priceUsdc: 0.08,
      license: "CC-BY-4.0",
      category: "ai-intelligence",
      title: `ERC-8004 Registry Activity Report — ${timestamp.slice(0, 16)}`,
      description:
        "On-chain activity digest for the ERC-8004 IdentityRegistry on Filecoin Calibration. " +
        "Tracks recent agent registrations and registry growth, " +
        "produced by the RFS-4 agent economy testbed.",
    },
  };
}
