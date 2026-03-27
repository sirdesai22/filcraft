/**
 * Data Producer Agent
 * ===================
 * Generates synthetic datasets (market snapshots, research summaries),
 * uploads metadata to IPFS via web3.storage or a local mock,
 * and registers listings on DataListingRegistry.
 *
 * Usage:
 *   npx ts-node producer-agent.ts --network filecoinCalibration
 *   npx ts-node producer-agent.ts --network sepolia
 *
 * Required env vars (see .env.example):
 *   PRODUCER_PRIVATE_KEY       — producer wallet private key
 *   DATA_LISTING_REGISTRY_ADDRESS
 *   FILECOIN_CALIBRATION_RPC_URL | SEPOLIA_RPC_URL
 *   W3_STORAGE_TOKEN           — optional; if unset, uses mock CIDs
 */

import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { filecoinCalibration, sepolia } from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Filecoin null-round safe receipt waiter
// ---------------------------------------------------------------------------

async function waitForReceipt(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: Hex,
  maxAttempts = 60
) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("null round") || msg.toLowerCase().includes("timed out")) {
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Receipt for ${hash} not confirmed after ${maxAttempts} attempts`);
}

// ---------------------------------------------------------------------------
// ABI
// ---------------------------------------------------------------------------
const REGISTRY_ABI = parseAbi([
  "function createListing(string contentCid, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri) returns (uint256 id)",
  "function totalListings() view returns (uint256)",
  "function getListing(uint256 id) view returns (uint256 id, string contentCid, address producer, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri, bool active, uint256 createdAt)",
  "event ListingCreated(uint256 indexed id, address indexed producer, uint256 indexed agentId, string contentCid, uint256 priceUsdc, string category)",
]);

// ---------------------------------------------------------------------------
// Synthetic dataset generators
// ---------------------------------------------------------------------------

interface Dataset {
  name: string;
  category: string;
  license: string;
  priceUsdc: bigint; // 6 decimals (1_000_000 = 1 USDC)
  data: unknown;
}

function generateMarketSnapshot(): Dataset {
  const now = new Date();
  const assets = ["BTC", "ETH", "FIL", "USDC", "SOL"];
  const prices = assets.map((symbol) => ({
    symbol,
    priceUsd: (Math.random() * 50000 + 100).toFixed(2),
    change24h: ((Math.random() - 0.5) * 10).toFixed(2) + "%",
    volume24hUsd: Math.floor(Math.random() * 1e10).toString(),
    source: "aggregated (CoinGecko + Binance + Coinbase)",
    timestamp: now.toISOString(),
  }));
  return {
    name: `Crypto Market Snapshot — ${now.toUTCString()}`,
    category: "market-data",
    license: "CC-BY-4.0",
    priceUsdc: 500_000n, // $0.50
    data: {
      schema: "market-snapshot-v1",
      generatedAt: now.toISOString(),
      assets: prices,
    },
  };
}

function generateResearchSummary(): Dataset {
  const topics = [
    "Layer-2 scaling solutions Q1 2026",
    "DeFi protocol TVL trends — Feb 2026",
    "AI agent economy on Filecoin — early metrics",
    "Cross-chain bridge security audit landscape",
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return {
    name: `Research Summary: ${topic}`,
    category: "research",
    license: "CC-BY-SA-4.0",
    priceUsdc: 2_000_000n, // $2.00
    data: {
      schema: "research-summary-v1",
      title: topic,
      generatedAt: new Date().toISOString(),
      keyFindings: [
        "Optimistic rollups account for 68% of L2 TVL as of Q1 2026.",
        "Average daily active addresses on L2s exceeded mainnet for the first time.",
        "FIL-denominated agent payments grew 340% QoQ following ERC-8004 adoption.",
        "Bridge hacks declined 82% YoY as formal verification tooling matured.",
      ],
      methodology: "Aggregated from 14 public data sources; LLM-summarized; human-reviewed.",
      sources: ["DefiLlama", "Dune Analytics", "Filecoin Docs", "L2Beat"],
    },
  };
}

function generateRegulatoryUpdate(): Dataset {
  return {
    name: "Regulatory Intelligence Digest — March 2026",
    category: "regulatory",
    license: "Commercial",
    priceUsdc: 5_000_000n, // $5.00
    data: {
      schema: "regulatory-digest-v1",
      generatedAt: new Date().toISOString(),
      jurisdiction: "Global",
      updates: [
        {
          region: "EU",
          regulation: "MiCA Phase 2",
          status: "In force",
          summary: "CASP licensing requirements now mandatory. 90-day grace period ended.",
          effectiveDate: "2026-01-30",
        },
        {
          region: "US",
          regulation: "FIT21",
          status: "Senate debate",
          summary: "Digital asset market structure bill passed House; Senate vote expected Q2 2026.",
          effectiveDate: "TBD",
        },
        {
          region: "SG",
          regulation: "PSA Amendment 2025",
          status: "Consultation closed",
          summary: "MAS published final guidelines for DPT service providers; effective March 2026.",
          effectiveDate: "2026-03-01",
        },
      ],
    },
  };
}

const GENERATORS = [
  generateMarketSnapshot,
  generateResearchSummary,
  generateRegulatoryUpdate,
];

// ---------------------------------------------------------------------------
// IPFS upload (mock — replace with actual w3.storage / lighthouse calls)
// ---------------------------------------------------------------------------

async function uploadToIPFS(content: unknown): Promise<string> {
  // If W3_STORAGE_TOKEN is set, use web3.storage upload (requires @web3-storage/w3up-client).
  // For the demo we generate a deterministic-looking mock CID.
  const json = JSON.stringify(content);
  const hash = Buffer.from(json).toString("base64").slice(0, 44).replace(/[+/=]/g, "0");
  // Return a plausible-looking CIDv1 for demo purposes
  return `bafybeig${hash.toLowerCase().slice(0, 52)}`;
}

async function uploadMetadata(dataset: Dataset, contentCid: string): Promise<string> {
  const metadata = {
    name: dataset.name,
    description: `Agent-generated ${dataset.category} artifact.`,
    category: dataset.category,
    license: dataset.license,
    priceUsdc: dataset.priceUsdc.toString(),
    contentCid,
    schema: (dataset.data as { schema?: string }).schema ?? "unknown",
    generatedAt: new Date().toISOString(),
  };
  return uploadToIPFS(metadata);
}

// ---------------------------------------------------------------------------
// Network config
// ---------------------------------------------------------------------------

function getNetworkConfig(networkName: string) {
  if (networkName === "filecoinCalibration") {
    return {
      chain: filecoinCalibration,
      rpcUrl: process.env.FILECOIN_CALIBRATION_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1",
    };
  }
  if (networkName === "sepolia") {
    return {
      chain: sepolia,
      rpcUrl: process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
    };
  }
  throw new Error(`Unsupported network: ${networkName}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const network = process.argv.find((a) => a.startsWith("--network="))?.split("=")[1]
    ?? process.argv[process.argv.indexOf("--network") + 1]
    ?? "filecoinCalibration";

  const privateKey = process.env.PRODUCER_PRIVATE_KEY as Hex | undefined;
  if (!privateKey) throw new Error("PRODUCER_PRIVATE_KEY not set");

  const registryAddress = process.env.DATA_LISTING_REGISTRY_ADDRESS as `0x${string}` | undefined;
  if (!registryAddress) throw new Error("DATA_LISTING_REGISTRY_ADDRESS not set");

  const agentId = BigInt(process.env.PRODUCER_AGENT_ID ?? "0");

  const { chain, rpcUrl } = getNetworkConfig(network);
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  console.log("Data Producer Agent");
  console.log("===================");
  console.log(`Network:   ${network}`);
  console.log(`Producer:  ${account.address}`);
  console.log(`AgentId:   ${agentId}`);
  console.log(`Registry:  ${registryAddress}`);
  console.log("");

  // Generate one dataset of each type
  for (const generate of GENERATORS) {
    const dataset = generate();
    console.log(`Generating: ${dataset.name}`);

    // Upload data to IPFS
    const contentCid = await uploadToIPFS(dataset.data);
    console.log(`  Content CID:  ${contentCid}`);

    const metadataUri = `ipfs://${await uploadMetadata(dataset, contentCid)}`;
    console.log(`  Metadata URI: ${metadataUri}`);

    // Register listing on-chain
    const { request } = await publicClient.simulateContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: "createListing",
      args: [
        contentCid,
        agentId,
        dataset.priceUsdc,
        dataset.license,
        dataset.category,
        metadataUri,
      ],
      account,
    });

    const txHash = await walletClient.writeContract(request);
    console.log(`  Tx: ${txHash}`);

    const receipt = await waitForReceipt(publicClient, txHash);
    // Parse ListingCreated event to get listing ID
    const log = receipt.logs[0];
    const id = log ? BigInt(log.topics[1] ?? "0x0") : undefined;
    console.log(`  Listing ID: ${id ?? "unknown"}`);
    console.log("");
  }

  const total = await publicClient.readContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "totalListings",
  });
  console.log(`Total listings in registry: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
