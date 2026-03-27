/**
 * marketplace.ts — DataListingRegistry client (Filecoin Calibration via viem).
 *
 * Registers artifact CIDs produced by strategy agents on the on-chain
 * DataListingRegistry so they appear in the FilCraft marketplace.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  type Hash,
} from "viem";
import { filecoinCalibration } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── Contract ──────────────────────────────────────────────────────────────────

const REGISTRY_ABI = parseAbi([
  "function createListing(string contentCid, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri) returns (uint256 id)",
  "event ListingCreated(uint256 indexed id, address indexed producer, uint256 indexed agentId, string contentCid, uint256 priceUsdc, string category)",
]);

const REGISTRY_ADDRESS =
  (process.env.DATA_LISTING_REGISTRY_ADDRESS as `0x${string}`) ||
  "0xdd6c9772e4a3218f8ca7acbaeeea2ce02eb1dbf6";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRpcUrl(): string {
  return (
    process.env.FILECOIN_CALIBRATION_RPC_URL ||
    "https://api.calibration.node.glif.io/rpc/v1"
  );
}

function walletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("AGENT_PRIVATE_KEY not set in .env");
  return createWalletClient({
    account: privateKeyToAccount(pk as `0x${string}`),
    chain: filecoinCalibration,
    transport: http(getRpcUrl()),
  });
}

function publicClient() {
  return createPublicClient({
    chain: filecoinCalibration,
    transport: http(getRpcUrl()),
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ListingParams {
  cid: string;
  agentId: number | bigint;
  priceUsdc: number; // in USDC (6-decimal, e.g. 0.5 = 500000 raw)
  license: string;   // e.g. "CC-BY-4.0"
  category: string;  // e.g. "ai-intelligence", "market-data", "research"
  metadataUri: string; // IPFS URI with full listing metadata
}

// ── Functions ─────────────────────────────────────────────────────────────────

/**
 * Register a new data artifact listing on DataListingRegistry.
 * Returns the on-chain listing ID.
 */
export async function registerListing(
  params: ListingParams,
  dryRun = false
): Promise<{ listingId: string | null; txHash: Hash | null }> {
  if (dryRun) {
    console.log(`[marketplace] dry-run — createListing(${params.cid}, agentId=${params.agentId})`);
    return { listingId: "DRY_RUN_LISTING_ID", txHash: null };
  }

  const priceRaw = BigInt(Math.round(params.priceUsdc * 1_000_000));
  const wc = walletClient();
  const pc = publicClient();

  const txHash = await wc.writeContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "createListing",
    args: [
      params.cid,
      BigInt(params.agentId),
      priceRaw,
      params.license,
      params.category,
      params.metadataUri,
    ],
  });

  const receipt = await pc.waitForTransactionReceipt({ hash: txHash });

  // Parse ListingCreated event to get the new ID
  let listingId: string | null = null;
  for (const log of receipt.logs) {
    if (log.topics[0]) {
      // topic[1] = id (indexed uint256)
      if (log.topics[1]) {
        listingId = BigInt(log.topics[1]).toString();
      }
    }
  }

  return { listingId, txHash };
}
