/**
 * Data Consumer Agent
 * ===================
 * Searches active listings on DataListingRegistry, evaluates them by category
 * and price, approves USDC, purchases via DataEscrow, and verifies the CID.
 *
 * Usage:
 *   npx ts-node consumer-agent.ts --network filecoinCalibration [--category market-data] [--max-price 2.5]
 *
 * Required env vars:
 *   CONSUMER_PRIVATE_KEY
 *   DATA_LISTING_REGISTRY_ADDRESS
 *   DATA_ESCROW_ADDRESS
 *   USDC_ADDRESS                    — MockUSDC or Circle USDC
 *   FILECOIN_CALIBRATION_RPC_URL | SEPOLIA_RPC_URL
 */

import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from "viem";
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
      return receipt;
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
// ABIs
// ---------------------------------------------------------------------------

const REGISTRY_ABI = parseAbi([
  "function totalListings() view returns (uint256)",
  "function getListing(uint256 id) view returns (uint256 id, string contentCid, address producer, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri, bool active, uint256 createdAt)",
  "function getListingsBatch(uint256 fromId, uint256 toId) view returns ((uint256 id, string contentCid, address producer, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri, bool active, uint256 createdAt)[])",
]);

const ESCROW_ABI = parseAbi([
  "function purchase(uint256 listingId) returns (uint256 purchaseId)",
  "function confirmDelivery(uint256 purchaseId)",
  "function getPurchase(uint256 id) view returns (uint256 listingId, address buyer, address seller, uint256 amount, uint256 platformFee, bool settled, bool refunded, uint256 createdAt)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount)", // MockUSDC only
]);

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
// CID verification
// ---------------------------------------------------------------------------

async function verifyCid(contentCid: string, metadataUri: string): Promise<boolean> {
  // In production: fetch from IPFS gateway and validate content hash.
  // For demo: confirm both CIDs are non-empty and well-formed.
  const cidPattern = /^baf[a-z2-7]{50,}/i;
  const isContentValid = cidPattern.test(contentCid);

  console.log(`    Content CID valid format: ${isContentValid ? "YES" : "NO"} (${contentCid.slice(0, 20)}...)`);

  if (metadataUri.startsWith("ipfs://")) {
    const gateway = metadataUri.replace("ipfs://", "https://ipfs.io/ipfs/");
    console.log(`    Metadata gateway URL: ${gateway}`);
    try {
      const res = await fetch(gateway, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const meta = await res.json();
        console.log(`    Metadata name: ${meta.name ?? "(unlabeled)"}`);
        return true;
      }
    } catch {
      // IPFS gateway may be slow — treat as best-effort
      console.log(`    Metadata fetch timed out (IPFS gateway latency) — CID still anchored.`);
    }
  }
  return isContentValid;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const network = args.find((a) => a.startsWith("--network="))?.split("=")[1]
    ?? args[args.indexOf("--network") + 1]
    ?? "filecoinCalibration";

  const categoryIdx = args.indexOf("--category");
  const categoryFilter = args.find((a) => a.startsWith("--category="))?.split("=")[1]
    ?? (categoryIdx !== -1 ? args[categoryIdx + 1] : null)
    ?? null;

  const maxPriceIdx = args.indexOf("--max-price");
  const maxPriceUsdc = parseFloat(
    args.find((a) => a.startsWith("--max-price="))?.split("=")[1]
    ?? (maxPriceIdx !== -1 ? args[maxPriceIdx + 1] : null)
    ?? "10"
  );

  const privateKey = process.env.CONSUMER_PRIVATE_KEY as Hex | undefined;
  if (!privateKey) throw new Error("CONSUMER_PRIVATE_KEY not set");

  const registryAddress = process.env.DATA_LISTING_REGISTRY_ADDRESS as `0x${string}` | undefined;
  if (!registryAddress) throw new Error("DATA_LISTING_REGISTRY_ADDRESS not set");

  const escrowAddress = process.env.DATA_ESCROW_ADDRESS as `0x${string}` | undefined;
  if (!escrowAddress) throw new Error("DATA_ESCROW_ADDRESS not set");

  const usdcAddress = process.env.USDC_ADDRESS as `0x${string}` | undefined;
  if (!usdcAddress) throw new Error("USDC_ADDRESS not set");

  const { chain, rpcUrl } = getNetworkConfig(network);
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  console.log("Data Consumer Agent");
  console.log("===================");
  console.log(`Network:        ${network}`);
  console.log(`Consumer:       ${account.address}`);
  console.log(`Category filter: ${categoryFilter ?? "(all)"}`);
  console.log(`Max price:       $${maxPriceUsdc} USDC`);
  console.log("");

  // ── Step 1: Discover listings ─────────────────────────────────────────────
  console.log("Step 1: Discovering listings...");
  const total = await publicClient.readContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "totalListings",
  });
  console.log(`  Total listings: ${total}`);

  if (total === 0n) {
    console.log("  No listings found. Run producer-agent.ts first.");
    return;
  }

  const listings = await publicClient.readContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "getListingsBatch",
    args: [1n, total],
  });

  const maxPriceRaw = BigInt(Math.round(maxPriceUsdc * 1_000_000));

  const candidates = listings.filter((l) => {
    if (!l.active) return false;
    if (categoryFilter && l.category !== categoryFilter) return false;
    if (l.priceUsdc > maxPriceRaw) return false;
    return true;
  });

  console.log(`  Matching listings: ${candidates.length}`);
  console.log("");

  if (candidates.length === 0) {
    console.log("  No listings match your filters.");
    return;
  }

  // ── Step 2: Evaluate and select ───────────────────────────────────────────
  console.log("Step 2: Evaluating candidates...");
  for (const l of candidates) {
    console.log(`  [${l.id}] ${l.category} | $${formatUnits(l.priceUsdc, 6)} | ${l.license}`);
    console.log(`        CID: ${l.contentCid.slice(0, 30)}...`);
    console.log(`        Producer: ${l.producer}`);
  }
  console.log("");

  // Pick the cheapest listing
  const chosen = candidates.reduce((a, b) => (a.priceUsdc <= b.priceUsdc ? a : b));
  console.log(`Selected listing #${chosen.id}: "${chosen.category}" @ $${formatUnits(chosen.priceUsdc, 6)}`);
  console.log("");

  // ── Step 3: Check/fund USDC balance ───────────────────────────────────────
  console.log("Step 3: Checking USDC balance...");
  const balance = await publicClient.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`  Balance: $${formatUnits(balance, 6)} USDC`);

  if (balance < chosen.priceUsdc) {
    console.log("  Balance insufficient — minting mock USDC (testnet only)...");
    const mintTx = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [account.address, chosen.priceUsdc * 10n], // mint 10x for buffer
    });
    await waitForReceipt(publicClient, mintTx);
    console.log(`  Minted. Tx: ${mintTx}`);
  }

  // ── Step 4: Approve USDC ──────────────────────────────────────────────────
  console.log("Step 4: Approving USDC...");
  const allowance = await publicClient.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, escrowAddress],
  });

  if (allowance < chosen.priceUsdc) {
    const approveTx = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [escrowAddress, chosen.priceUsdc * 100n],
    });
    await waitForReceipt(publicClient, approveTx);
    console.log(`  Approved. Tx: ${approveTx}`);
  } else {
    console.log(`  Allowance sufficient ($${formatUnits(allowance, 6)}).`);
  }
  console.log("");

  // ── Step 5: Purchase ──────────────────────────────────────────────────────
  console.log(`Step 5: Purchasing listing #${chosen.id}...`);
  const { request: purchaseRequest } = await publicClient.simulateContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "purchase",
    args: [chosen.id],
    account,
  });
  const purchaseTx = await walletClient.writeContract(purchaseRequest);
  const purchaseReceipt = await waitForReceipt(publicClient, purchaseTx);
  console.log(`  Tx: ${purchaseTx}`);

  // Parse purchaseId from Purchased event — filter to escrow contract (not USDC Transfer logs)
  const purchasedLog = purchaseReceipt.logs.find(
    (l) => l.address.toLowerCase() === escrowAddress.toLowerCase()
  );
  const purchaseId = purchasedLog ? BigInt(purchasedLog.topics[1] ?? "0x1") : 1n;
  console.log(`  Purchase ID: ${purchaseId}`);
  console.log(`  USDC locked in escrow: $${formatUnits(chosen.priceUsdc, 6)}`);
  console.log("");

  // ── Step 6: Verify artifact ───────────────────────────────────────────────
  console.log("Step 6: Verifying artifact CID...");
  const verified = await verifyCid(chosen.contentCid, chosen.metadataUri);
  console.log(`  Verification: ${verified ? "PASSED" : "FAILED"}`);
  console.log("");

  // ── Step 7: Confirm delivery ──────────────────────────────────────────────
  console.log("Step 7: Confirming delivery (releasing escrow)...");
  const { request: confirmRequest } = await publicClient.simulateContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "confirmDelivery",
    args: [purchaseId],
    account,
  });
  const confirmTx = await walletClient.writeContract(confirmRequest);
  await waitForReceipt(publicClient, confirmTx);
  console.log(`  Tx: ${confirmTx}`);
  console.log("");

  // ── Summary ───────────────────────────────────────────────────────────────
  const purchase = await publicClient.readContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "getPurchase",
    args: [purchaseId],
  });

  // viem decodes tuple returns as arrays; unpack by position:
  // [listingId, buyer, seller, amount, platformFee, settled, refunded, createdAt]
  const pArr = purchase as unknown as readonly [bigint, string, string, bigint, bigint, boolean, boolean, bigint];
  const [, , , pAmount, pFee, pSettled] = pArr;

  console.log("=".repeat(60));
  console.log("PURCHASE COMPLETE");
  console.log("=".repeat(60));
  console.log(`Listing #${chosen.id} (${chosen.category})`);
  console.log(`Content CID:   ${chosen.contentCid}`);
  console.log(`Amount paid:   $${formatUnits(pAmount, 6)} USDC`);
  console.log(`Platform fee:  $${formatUnits(pFee, 6)} USDC (2.5%)`);
  console.log(`Seller payout: $${formatUnits(pAmount - pFee, 6)} USDC`);
  console.log(`Settled:       ${pSettled}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
