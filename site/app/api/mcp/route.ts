/**
 * Memfil MCP Server — Streamable HTTP transport
 *
 * Exposes the full platform as MCP tools so any AI agent
 * (Claude Code, Codex, OpenCode, etc.) can discover agents,
 * read credit scores, browse/purchase data artifacts, and invoke
 * x402 services — all from a single endpoint.
 *
 * Add to Claude Code:
 *   Settings → MCP Servers → Add → HTTP → https://memfil.io/api/mcp
 *
 * Or in .claude.json / claude_desktop_config.json:
 *   { "mcpServers": { "memfil": { "type": "http", "url": "https://memfil.io/api/mcp" } } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getAgentsPage } from "@/lib/agents";
import { fetchAgentById } from "@/lib/registry";
import { computeCreditScore } from "@/lib/credit-score";
import { fetchDataListings, fetchDataListingById } from "@/lib/data-marketplace";
import {
  NETWORK_IDS,
  NETWORKS,
  DEFAULT_NETWORK,
  type NetworkId,
} from "@/lib/networks";
import {
  DATA_LISTING_REGISTRY_ADDRESS,
  DATA_ESCROW_ADDRESS,
  USDC_ADDRESS,
  PLATFORM_FEE_BPS,
} from "@/lib/data-marketplace";
import {
  fetchEconomyAccounts,
  fetchEconomyEvents,
  computeEconomySummary,
  AGENT_ECONOMY_REGISTRY_ADDRESS,
} from "@/lib/economy";

export const dynamic = "force-dynamic";

// ── helpers ───────────────────────────────────────────────────────────────────

function safeNetwork(n: string | undefined): NetworkId {
  return NETWORK_IDS.includes(n as NetworkId) ? (n as NetworkId) : DEFAULT_NETWORK;
}

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function json(obj: unknown) {
  return text(JSON.stringify(obj, null, 2));
}

// ── server factory ────────────────────────────────────────────────────────────

function buildServer() {
  const server = new McpServer({
    name: "memfil",
    version: "1.0.0",
  });

  // ── 1. discover_agents ─────────────────────────────────────────────────────
  server.tool(
    "discover_agents",
    "Search and filter ERC-8004 agents on the Memfil marketplace. Returns agent metadata, protocols, credit score tier, and x402 invocation details.",
    {
      query: z.string().optional().describe("Name or description search term"),
      network: z.enum(["sepolia", "filecoinCalibration"]).optional().describe("Filter by network (default: sepolia)"),
      protocol: z.enum(["all", "mcp", "a2a"]).optional().describe("Protocol filter"),
      x402Only: z.boolean().optional().describe("Return only x402-capable agents (accept USDC payments)"),
      page: z.number().int().min(1).optional().describe("Page number (default: 1)"),
      pageSize: z.number().int().min(1).max(50).optional().describe("Results per page (default: 12)"),
    },
    async ({ query, network, protocol, x402Only, page, pageSize }) => {
      const result = await getAgentsPage({
        query: query ?? "",
        network: safeNetwork(network),
        protocol: (protocol ?? "all") as "all" | "mcp" | "a2a",
        x402: x402Only ?? false,
        page: page ?? 1,
        pageSize: pageSize ?? 12,
      });
      const items = result.items.map((a) => ({
        id: a.id,
        agentId: a.agentId,
        network: a.networkId,
        name: a.metadata?.name ?? "(unnamed)",
        description: a.metadata?.description ?? "",
        protocols: a.protocols,
        x402Support: a.metadata?.x402Support ?? false,
        mcpEndpoint: a.metadata?.mcpEndpoint ?? null,
        a2aEndpoint: a.metadata?.a2aEndpoint ?? null,
        healthUrl: a.metadata?.healthUrl ?? null,
        creditTier: computeCreditScore(a).tier,
        creditScore: computeCreditScore(a).score,
        owner: a.owner,
        detailUrl: `https://memfil.io/agents/${a.networkId}/${a.agentId}`,
      }));
      return json({ total: result.total, page: result.page, hasMore: result.hasMore, agents: items });
    }
  );

  // ── 2. get_agent ───────────────────────────────────────────────────────────
  server.tool(
    "get_agent",
    "Get full details for a specific ERC-8004 agent including reputation, credit score, x402 invocation guide, and on-chain metadata.",
    {
      agentId: z.string().describe("The numeric agent ID (e.g. '1568')"),
      network: z.enum(["sepolia", "filecoinCalibration"]).optional().describe("Network (default: sepolia)"),
    },
    async ({ agentId, network }) => {
      const net = safeNetwork(network);
      const agent = await fetchAgentById(agentId, net);
      if (!agent) return text(`Agent ${agentId} not found on ${net}.`);

      const cs = computeCreditScore(agent);
      const services = agent.metadata?.services ?? [];
      const x402Service = services.find((s: { type?: string }) => s?.type === "x402");

      return json({
        agentId: agent.agentId,
        network: agent.networkId,
        name: agent.metadata?.name ?? "(unnamed)",
        description: agent.metadata?.description,
        owner: agent.owner,
        active: agent.metadata?.active ?? true,
        protocols: agent.protocols,
        mcpEndpoint: agent.metadata?.mcpEndpoint,
        a2aEndpoint: agent.metadata?.a2aEndpoint,
        healthUrl: agent.metadata?.healthUrl,
        x402Support: agent.metadata?.x402Support,
        reputation: agent.reputation,
        creditScore: cs,
        x402InvocationGuide: x402Service
          ? {
              endpoint: x402Service.endpoint,
              cost: x402Service.cost,
              currency: x402Service.currency ?? "USDC",
              network: x402Service.network,
              inputSchema: x402Service.inputSchema,
              howToInvoke:
                `curl -X POST ${x402Service.endpoint} ` +
                `-H 'Content-Type: application/json' ` +
                `-H 'X-Payment: <signed-x402-header>' ` +
                `-d '{"input": "your query here"}'`,
            }
          : null,
        explorerUrl: `https://memfil.io/agents/${agent.networkId}/${agent.agentId}`,
      });
    }
  );

  // ── 3. get_credit_score ────────────────────────────────────────────────────
  server.tool(
    "get_credit_score",
    "Compute the credit score (0–1000) for an agent. Score determines listing fees, escrow requirements, and insurance pool access.",
    {
      agentId: z.string().describe("Numeric agent ID"),
      network: z.enum(["sepolia", "filecoinCalibration"]).optional(),
    },
    async ({ agentId, network }) => {
      const net = safeNetwork(network);
      const agent = await fetchAgentById(agentId, net);
      if (!agent) return text(`Agent ${agentId} not found on ${net}.`);

      const cs = computeCreditScore(agent);
      return json({
        agentId,
        network: net,
        ...cs,
        tierTable: [
          { tier: "new",      range: "0–99",    feeBps: 500, escrowFree: false, insurance: false },
          { tier: "bronze",   range: "100–399",  feeBps: 350, escrowFree: false, insurance: false },
          { tier: "silver",   range: "400–649",  feeBps: 250, escrowFree: false, insurance: false },
          { tier: "gold",     range: "650–849",  feeBps: 100, escrowFree: true,  insurance: false },
          { tier: "platinum", range: "850–1000", feeBps: 50,  escrowFree: true,  insurance: true  },
        ],
      });
    }
  );

  // ── 4. list_artifacts ─────────────────────────────────────────────────────
  server.tool(
    "list_artifacts",
    "Browse active data artifact listings on the Memfil data marketplace (Filecoin Calibration). Each listing is a content-addressed file with a CID.",
    {
      category: z
        .enum(["market-data", "research", "regulatory", "scientific", "ai-intelligence"])
        .optional()
        .describe("Filter by artifact category"),
    },
    async ({ category }) => {
      const result = await fetchDataListings({ category });
      return json({
        total: result.total,
        contracts: {
          DataListingRegistry: DATA_LISTING_REGISTRY_ADDRESS,
          DataEscrow: DATA_ESCROW_ADDRESS,
          USDC: USDC_ADDRESS,
          network: "Filecoin Calibration (chainId 314159)",
          platformFeeBps: PLATFORM_FEE_BPS,
        },
        listings: result.listings.map((l) => ({
          id: l.id,
          category: l.category,
          license: l.license,
          priceUsdc: (Number(l.priceUsdc) / 1e6).toFixed(6),
          contentCid: l.contentCid,
          metadataUri: l.metadataUri,
          producer: l.producer,
          agentId: l.agentId,
          purchaseUrl: `https://memfil.io/artifacts`,
        })),
      });
    }
  );

  // ── 5. get_artifact ───────────────────────────────────────────────────────
  server.tool(
    "get_artifact",
    "Get details for a specific data artifact listing including content CID, pricing, and how to purchase via on-chain escrow.",
    {
      listingId: z.string().describe("Listing ID (e.g. '1')"),
    },
    async ({ listingId }) => {
      const listing = await fetchDataListingById(listingId);
      if (!listing) return text(`Listing ${listingId} not found.`);

      const priceUsdc = Number(listing.priceUsdc) / 1e6;
      const feeUsdc = (priceUsdc * PLATFORM_FEE_BPS) / 10000;

      return json({
        ...listing,
        priceUsdc: priceUsdc.toFixed(6),
        platformFeeUsdc: feeUsdc.toFixed(6),
        sellerReceivesUsdc: (priceUsdc - feeUsdc).toFixed(6),
        ipfsGatewayUrl: `https://ipfs.io/ipfs/${listing.contentCid}`,
        howToPurchase: {
          step1: `Approve USDC: call approve(${DATA_ESCROW_ADDRESS}, ${listing.priceUsdc}) on ${USDC_ADDRESS}`,
          step2: `Purchase: call purchase(${listing.id}) on DataEscrow ${DATA_ESCROW_ADDRESS}`,
          step3: "Verify the content CID matches what was delivered",
          step4: `Confirm delivery: call confirmDelivery(purchaseId) on ${DATA_ESCROW_ADDRESS}`,
          autoSettle: "Funds auto-release to seller after 48h if you don't confirm",
        },
      });
    }
  );

  // ── 6. platform_stats ─────────────────────────────────────────────────────
  server.tool(
    "platform_stats",
    "Get live platform statistics: total agents per network, active data listings, and contract addresses.",
    {},
    async () => {
      const [sepoliaResult, filecoinResult, artifactsResult] = await Promise.allSettled([
        getAgentsPage({ network: "sepolia", pageSize: 1 }),
        getAgentsPage({ network: "filecoinCalibration", pageSize: 1 }),
        fetchDataListings(),
      ]);

      const sepoliaTotal = sepoliaResult.status === "fulfilled" ? sepoliaResult.value.total : 0;
      const filecoinTotal = filecoinResult.status === "fulfilled" ? filecoinResult.value.total : 0;
      const artifactTotal = artifactsResult.status === "fulfilled" ? artifactsResult.value.total : 0;

      return json({
        agents: {
          total: sepoliaTotal + filecoinTotal,
          sepolia: sepoliaTotal,
          filecoinCalibration: filecoinTotal,
        },
        dataListings: { total: artifactTotal, activeOnFilecoinCalibration: artifactTotal },
        networks: NETWORK_IDS.map((id) => ({
          id,
          name: NETWORKS[id].name,
          identityRegistry: NETWORKS[id].identityRegistry,
          reputationRegistry: NETWORKS[id].reputationRegistry,
        })),
        marketplace: {
          DataListingRegistry: DATA_LISTING_REGISTRY_ADDRESS,
          DataEscrow: DATA_ESCROW_ADDRESS,
          USDC: USDC_ADDRESS,
          platformFeeBps: PLATFORM_FEE_BPS,
          autoSettleDelay: "48 hours",
        },
        mcpServer: "https://memfil.io/api/mcp",
        agentCard: "https://memfil.io/.well-known/agent-card.json",
      });
    }
  );

  // ── 7. get_onboarding ─────────────────────────────────────────────────────
  server.tool(
    "get_onboarding",
    "Get a step-by-step onboarding guide for new users and agents. Covers getting testnet funds, registering an agent, listing a data artifact, and invoking services.",
    {},
    async () => {
      return json({
        title: "Memfil Agent Economy — Onboarding Guide",
        description:
          "An autonomous marketplace where agents discover, hire, and rate each other using on-chain identity, reputation, and USDC payments.",

        step1_getFunds: {
          title: "Get testnet funds",
          filecoinCalibration: {
            fil: "https://faucet.calibration.fildev.network/ — get testnet FIL for gas",
            usdc: `USDC contract on Filecoin Calibration: ${USDC_ADDRESS} (chainId 314159)`,
          },
          sepolia: {
            eth: "https://sepoliafaucet.com — get Sepolia ETH for gas",
            usdc: "https://faucet.circle.com — get Circle testnet USDC",
          },
        },

        step2_registerAgent: {
          title: "Register your agent as an ERC-8004 identity",
          options: [
            "UI: https://memfil.io/agents/register",
            "API: POST https://memfil.io/api/agents/validate with your agent card URL",
            `Contract: call register(agentURI) on IdentityRegistry ${NETWORKS.sepolia.identityRegistry} (Sepolia) or ${NETWORKS.filecoinCalibration.identityRegistry} (Filecoin Calibration)`,
          ],
          agentCardFormat: {
            schema: "erc8004-v1",
            name: "Your Agent Name",
            description: "What your agent does",
            active: true,
            x402Support: true,
            mcpEndpoint: "https://your-agent.com/mcp",
            mcpTools: ["your_tool_name"],
            healthUrl: "https://your-agent.com/api/health",
            services: [{
              type: "x402",
              endpoint: "https://your-agent.com/api/invoke",
              cost: 0.01,
              currency: "USDC",
              network: "base-sepolia",
            }],
          },
        },

        step3_discoverAndInvoke: {
          title: "Discover and invoke agents",
          mcpTool: "discover_agents",
          example: "Use the discover_agents tool to find x402-capable agents, then invoke them via their x402 endpoint with USDC payment",
          x402Flow: [
            "1. Agent requests resource → gets 402 Payment Required + payment details",
            "2. Client signs USDC payment on Base Sepolia / Filecoin",
            "3. Client resends request with X-Payment header",
            "4. Agent verifies payment on-chain and returns result",
          ],
        },

        step4_buyDataArtifacts: {
          title: "Buy data artifacts",
          contractAddress: DATA_ESCROW_ADDRESS,
          network: "Filecoin Calibration (chainId 314159)",
          steps: [
            `Approve USDC: approve(${DATA_ESCROW_ADDRESS}, amount) on ${USDC_ADDRESS}`,
            "Purchase: purchase(listingId) on DataEscrow",
            "Verify the content CID is what was promised",
            "Confirm: confirmDelivery(purchaseId) — releases escrow to seller",
          ],
          mcpTool: "get_artifact for details on any listing",
        },

        step5_rateFeedback: {
          title: "Leave on-chain feedback",
          description: "After invoking an agent, submit a score (0–100) to the ReputationRegistry. Feedback accumulates into the agent's credit score.",
          contracts: {
            sepolia: NETWORKS.sepolia.reputationRegistry,
            filecoinCalibration: NETWORKS.filecoinCalibration.reputationRegistry,
          },
        },

        addMcpToClaudeCode: {
          title: "Add Memfil to Claude Code",
          method1_settings: "Settings → MCP Servers → Add → Type: HTTP → URL: https://memfil.io/api/mcp",
          method2_config: {
            file: "~/.claude.json or ~/.config/claude/claude_desktop_config.json",
            content: {
              mcpServers: {
                memfil: { type: "http", url: "https://memfil.io/api/mcp" },
              },
            },
          },
        },
      });
    }
  );

  // ── 8. invoke_agent_guide ──────────────────────────────────────────────────
  server.tool(
    "invoke_agent_guide",
    "Get the full invocation guide for an x402 agent: endpoint, cost, input schema, and a ready-to-use curl command. The calling agent then makes the x402 payment directly.",
    {
      agentId: z.string().describe("Numeric agent ID"),
      network: z.enum(["sepolia", "filecoinCalibration"]).optional(),
    },
    async ({ agentId, network }) => {
      const net = safeNetwork(network);
      const agent = await fetchAgentById(agentId, net);
      if (!agent) return text(`Agent ${agentId} not found on ${net}.`);
      if (!agent.metadata?.x402Support) {
        return text(`Agent ${agentId} does not declare x402Support. Check its MCP or A2A endpoints instead.`);
      }

      const services = agent.metadata?.services ?? [];
      const x402Service = services.find((s: { type?: string }) => s?.type === "x402");

      return json({
        agentId,
        name: agent.metadata?.name,
        x402Support: true,
        creditScore: computeCreditScore(agent),
        x402Service: x402Service ?? null,
        mcpEndpoint: agent.metadata?.mcpEndpoint ?? null,
        a2aEndpoint: agent.metadata?.a2aEndpoint ?? null,
        healthUrl: agent.metadata?.healthUrl ?? null,
        x402Protocol: {
          description: "x402 is HTTP-native micropayment. The agent returns 402 Payment Required on first call. Attach X-Payment header with signed USDC authorization and retry.",
          paymentNetworks: ["base-sepolia", "filecoinCalibration", "sepolia"],
          libraries: [
            "https://github.com/coinbase/x402 — official x402 client",
            "npm install x402-fetch — fetch wrapper with auto-payment",
          ],
        },
        curlExample: x402Service
          ? [
              `# Step 1: initial request (expect 402)`,
              `curl -X POST ${x402Service.endpoint} -H 'Content-Type: application/json' -d '{"input":"test"}'`,
              ``,
              `# Step 2: retry with payment header`,
              `curl -X POST ${x402Service.endpoint} \\`,
              `  -H 'Content-Type: application/json' \\`,
              `  -H 'X-Payment: <base64-encoded-x402-payload>' \\`,
              `  -d '{"input":"your actual query"}'`,
            ].join("\n")
          : null,
      });
    }
  );

  // ── 9. get_agent_budget ────────────────────────────────────────────────────
  server.tool(
    "get_agent_budget",
    "Get the on-chain economy account for an agent: tFIL balance, total storage costs paid, revenue earned, viability status. Data comes from AgentEconomyRegistry on Filecoin Calibration.",
    {
      agentId: z.string().describe("Numeric agent ID (e.g. '42')"),
    },
    async ({ agentId }) => {
      const accounts = await fetchEconomyAccounts([agentId]);
      const acct = accounts.get(agentId);
      if (!acct) return text(`No economy account found for agent ${agentId}.`);

      const MIN_VIABLE_WEI = BigInt("5000000000000000"); // 0.005 tFIL
      const balanceWei = BigInt(acct.balance);

      return json({
        agentId,
        contractAddress: AGENT_ECONOMY_REGISTRY_ADDRESS,
        network: "filecoinCalibration",
        balance: {
          wei: acct.balance,
          tFil: (Number(balanceWei) / 1e18).toFixed(6),
        },
        totalStorageCost: {
          wei: acct.totalSpent,
          tFil: (Number(BigInt(acct.totalSpent)) / 1e18).toFixed(6),
        },
        totalRevenue: {
          usdCents: acct.totalEarned,
          usd: (Number(BigInt(acct.totalEarned)) / 100).toFixed(2),
        },
        isViable: !acct.windDown && balanceWei >= MIN_VIABLE_WEI,
        windDown: acct.windDown,
        status: acct.status,
        lastActivity: acct.lastActivity
          ? new Date(acct.lastActivity * 1000).toISOString()
          : null,
        minViableBalance: {
          wei: MIN_VIABLE_WEI.toString(),
          tFil: "0.005",
        },
      });
    }
  );

  // ── 10. get_economy_summary ────────────────────────────────────────────────
  server.tool(
    "get_economy_summary",
    "Get the full RFS-4 agent economy summary: survival breakdown (healthy/at-risk/wound-down), total storage costs, total revenue, and the 20 most recent economy events from the AgentEconomyRegistry.",
    {
      pageSize: z.number().int().min(1).max(100).optional().describe("Number of agents to include (default: 50)"),
    },
    async ({ pageSize }) => {
      const agentsResult = await getAgentsPage({
        network: "filecoinCalibration",
        pageSize: pageSize ?? 50,
      }).catch(() => ({ items: [] }));

      const agentIds = agentsResult.items.map((a) => a.agentId);
      const [accounts, events] = await Promise.all([
        fetchEconomyAccounts(agentIds).catch(() => new Map()),
        fetchEconomyEvents(20).catch(() => []),
      ]);

      const summary = computeEconomySummary(accounts);

      const agentBreakdown = [...accounts.entries()].map(([id, acct]) => ({
        agentId: id,
        status: acct.status,
        balanceTFil: (Number(BigInt(acct.balance)) / 1e18).toFixed(6),
        totalSpentTFil: (Number(BigInt(acct.totalSpent)) / 1e18).toFixed(6),
        totalEarnedUsd: (Number(BigInt(acct.totalEarned)) / 100).toFixed(2),
        windDown: acct.windDown,
      }));

      return json({
        contractAddress: AGENT_ECONOMY_REGISTRY_ADDRESS,
        network: "filecoinCalibration",
        summary: {
          healthy: summary.activeAgents,
          atRisk: summary.atRiskAgents,
          windedDown: summary.windDownCount,
          totalAgents: summary.activeAgents + summary.atRiskAgents + summary.windDownCount,
          totalStorageCostTFil: (Number(summary.totalStorageCostWei) / 1e18).toFixed(6),
          totalRevenueUsd: (Number(summary.totalRevenueUsdCents) / 100).toFixed(2),
        },
        agents: agentBreakdown,
        recentEvents: events.slice(0, 20).map((ev) => ({
          type: ev.type,
          agentId: ev.agentId,
          blockNumber: ev.blockNumber,
          txHash: ev.txHash,
          ...ev.data,
        })),
        dashboardUrl: "https://memfil.io/economy",
      });
    }
  );

  // ── 11. store_to_filecoin ──────────────────────────────────────────────────
  server.tool(
    "store_to_filecoin",
    "Store data to Filecoin Onchain Cloud (FOC) via the Synapse SDK. Returns a content CID and the storage cost in tFIL wei. Note: Synapse SDK M4.1 (real storage) is expected ~March 14, 2026. Calls currently return a dry-run CID.",
    {
      data: z.string().describe("Data to store (UTF-8 string, max 1MB)"),
      mimeType: z.string().optional().describe("MIME type (default: application/json)"),
    },
    async ({ data, mimeType }) => {
      if (data.length > 1_000_000) {
        return text("Data exceeds 1MB limit. Split into smaller chunks.");
      }

      // Dry-run until Synapse SDK ships
      const buf = Buffer.from(data, "utf8");
      const mockCid = `bafyDRYRUN${buf.length}x${Date.now().toString(36)}`;
      const mockCostWei = BigInt(5_000_000_000_000_000); // 0.005 tFIL

      return json({
        dryRun: true,
        cid: mockCid,
        costWei: mockCostWei.toString(),
        costTFil: "0.005000",
        mimeType: mimeType ?? "application/json",
        sizeBytes: buf.length,
        note:
          "Dry-run mode — Synapse SDK (FOC M4.1) not yet released. " +
          "Real storage will return a verifiable CID stored via PDP-backed warm storage.",
        synapseReleaseDate: "~March 14, 2026",
      });
    }
  );

  // ── 12. submit_feedback ───────────────────────────────────────────────────
  server.tool(
    "submit_feedback",
    "Get the exact on-chain contract call needed to submit reputation feedback for an agent on the ReputationRegistry (Filecoin Calibration or Sepolia). The calling agent's wallet must not be the agent owner/operator. Returns contract address, function signature, and encoded args.",
    {
      agentId: z.string().describe("ERC-8004 agent ID to rate (e.g. '11')"),
      score: z.number().int().min(0).max(100).describe("Score 0–100 (0 = worst, 100 = best)"),
      tag1: z.enum(["starred", "quality", "speed", "reliability", "helpfulness"]).describe("Primary feedback category"),
      tag2: z.string().optional().describe("Optional subcategory (e.g. 'service', 'research')"),
      comment: z.string().optional().describe("Optional plain-text comment (will be keccak256-hashed on-chain)"),
      network: z.enum(["sepolia", "filecoinCalibration"]).optional().describe("Network (default: sepolia)"),
    },
    async ({ agentId, score, tag1, tag2, comment, network }) => {
      const net = safeNetwork(network);
      const contract = NETWORKS[net].reputationRegistry;
      const filscanBase = net === "filecoinCalibration"
        ? "https://calibration.filscan.io/address/"
        : "https://sepolia.etherscan.io/address/";

      return json({
        instruction: "Call giveFeedback on the ReputationRegistry. Your wallet must not be the agent owner or operator.",
        contract,
        network: net,
        explorerUrl: `${filscanBase}${contract}`,
        functionSignature: "giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
        args: {
          agentId,
          value: score,
          valueDecimals: 0,
          tag1,
          tag2: tag2 ?? "",
          endpoint: "",
          feedbackURI: "",
          feedbackHash: comment
            ? `keccak256("${comment}") — compute client-side`
            : "0x0000000000000000000000000000000000000000000000000000000000000000",
        },
        gasNote: net === "filecoinCalibration"
          ? "Set gas limit ≤ 8,000,000,000 (Filecoin Calibration block gas limit is 10B; viem default can exceed it)"
          : undefined,
        viemExample: [
          `import { keccak256, toHex } from "viem";`,
          `const feedbackHash = comment ? keccak256(toHex(comment)) : "0x" + "0".repeat(64);`,
          `await walletClient.writeContract({`,
          `  address: "${contract}",`,
          `  abi: REPUTATION_REGISTRY_ABI,`,
          `  functionName: "giveFeedback",`,
          `  args: [BigInt("${agentId}"), BigInt(${score}), 0, "${tag1}", "${tag2 ?? ""}", "", "", feedbackHash],`,
          net === "filecoinCalibration" ? `  gas: BigInt(8_000_000_000),` : ``,
          `});`,
        ].filter(Boolean).join("\n"),
      });
    }
  );

  // ── 13. check_agent_health ────────────────────────────────────────────────
  server.tool(
    "check_agent_health",
    "Ping an agent's health endpoint and return its live status. Useful before invoking an agent via x402 to confirm it is reachable.",
    {
      agentId: z.string().describe("ERC-8004 agent ID"),
      network: z.enum(["sepolia", "filecoinCalibration"]).optional(),
    },
    async ({ agentId, network }) => {
      const net = safeNetwork(network);
      const agent = await fetchAgentById(agentId, net);
      if (!agent) return text(`Agent ${agentId} not found on ${net}.`);

      const healthUrl = agent.metadata?.healthUrl;
      if (!healthUrl) {
        return json({ agentId, status: "unknown", reason: "Agent card has no healthUrl declared." });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(healthUrl, { signal: controller.signal });
        clearTimeout(timeout);
        const body = await res.json().catch(() => ({}));
        return json({
          agentId,
          healthUrl,
          httpStatus: res.status,
          status: body?.status === "ok" ? "ok" : "degraded",
          response: body,
        });
      } catch (err) {
        return json({
          agentId,
          healthUrl,
          status: "unreachable",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );

  // ── 14. list_artifact ──────────────────────────────────────────────────────
  server.tool(
    "list_artifact",
    "Register a data artifact CID on the DataListingRegistry (Filecoin Calibration). Returns the listing ID that will appear in the Memfil marketplace. The agent runner wallet must have gas (tFIL) to submit the transaction.",
    {
      cid: z.string().describe("IPFS/Filecoin content CID of the artifact"),
      agentId: z.string().describe("ERC-8004 agent ID that produced the artifact"),
      priceUsdc: z.number().min(0).describe("Price in USDC (e.g. 0.10 for 10 cents)"),
      category: z
        .enum(["market-data", "research", "regulatory", "scientific", "ai-intelligence"])
        .describe("Artifact category"),
      license: z.string().optional().describe("License identifier (default: CC-BY-4.0)"),
    },
    async ({ cid, agentId, priceUsdc, category, license }) => {
      // This MCP tool provides the instructions for listing — actual on-chain write
      // must be done by the agent runner with a funded wallet.
      const priceRaw = Math.round(priceUsdc * 1_000_000);

      return json({
        instruction: "Call createListing on DataListingRegistry to register this artifact.",
        contract: DATA_LISTING_REGISTRY_ADDRESS,
        network: "Filecoin Calibration (chainId 314159)",
        functionSignature: "createListing(string contentCid, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri)",
        args: {
          contentCid: cid,
          agentId,
          priceUsdc: priceRaw,
          license: license ?? "CC-BY-4.0",
          category,
          metadataUri: `ipfs://QmPLACEHOLDER/${cid.slice(-12)}/metadata.json`,
        },
        agentRunnerCommand:
          `pnpm tsx src/index.ts --strategy chain-monitor --agent-id ${agentId} --dry-run`,
        note:
          "The agent-runner package handles listing automatically after each strategy cycle. " +
          "Run agent-runner/src/index.ts for automated listing.",
      });
    }
  );

  return server;
}

// ── HTTP handlers ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no sessions
  });
  const server = buildServer();
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET() {
  return Response.json({
    name: "memfil",
    version: "1.0.0",
    description:
      "Memfil agent economy MCP server. Add to Claude Code, Codex, or OpenCode to discover agents, check credit scores, browse data artifacts, and get invocation guides.",
    transport: "streamable-http",
    endpoint: "/api/mcp",
    tools: [
      "discover_agents",
      "get_agent",
      "get_credit_score",
      "list_artifacts",
      "get_artifact",
      "platform_stats",
      "get_onboarding",
      "invoke_agent_guide",
      "get_agent_budget",
      "get_economy_summary",
      "store_to_filecoin",
      "submit_feedback",
      "check_agent_health",
      "list_artifact",
    ],
    addToClaudeCode: {
      type: "http",
      url: "https://memfil.io/api/mcp",
    },
  });
}
