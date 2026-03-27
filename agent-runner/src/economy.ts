/**
 * economy.ts — AgentEconomyRegistry client (Filecoin Calibration via viem).
 *
 * Provides typed wrappers for all on-chain economy operations used by the runner.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hash,
  type PublicClient,
} from "viem";
import { filecoinCalibration } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── Contract ABI (minimal subset used by runner) ─────────────────────────────

const ECONOMY_ABI = parseAbi([
  "function topUp(uint256 agentId) payable",
  "function recordStorageCost(uint256 agentId, uint256 costWei, string cid)",
  "function recordRevenue(uint256 agentId, uint256 usdCents)",
  "function triggerWindDown(uint256 agentId, string reason)",
  "function isViable(uint256 agentId) view returns (bool)",
  "function getAccount(uint256 agentId) view returns (uint256 balance, uint256 totalSpent, uint256 totalEarned, uint256 lastActivity, bool windDown)",
  "function MIN_VIABLE_BALANCE() view returns (uint256)",
  "event BudgetDeposited(uint256 indexed agentId, address indexed sponsor, uint256 amount)",
  "event StorageCostRecorded(uint256 indexed agentId, uint256 costWei, string cid)",
  "event RevenueRecorded(uint256 indexed agentId, uint256 usdCents)",
  "event AgentWindDown(uint256 indexed agentId, uint256 remainingBalance, string reason)",
]);

// ── Addresses ─────────────────────────────────────────────────────────────────

function getAddress(): `0x${string}` {
  const addr = process.env.AGENT_ECONOMY_REGISTRY_ADDRESS;
  if (!addr) throw new Error("AGENT_ECONOMY_REGISTRY_ADDRESS not set in .env");
  return addr as `0x${string}`;
}

function getRpcUrl(): string {
  return (
    process.env.FILECOIN_CALIBRATION_RPC_URL ||
    "https://api.calibration.node.glif.io/rpc/v1"
  );
}

// ── Client factories ──────────────────────────────────────────────────────────

function publicClient(): PublicClient {
  return createPublicClient({
    chain: filecoinCalibration,
    transport: http(getRpcUrl()),
  });
}

function walletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("AGENT_PRIVATE_KEY not set in .env");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: filecoinCalibration,
    transport: http(getRpcUrl()),
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentAccount {
  balance: bigint;
  totalSpent: bigint;
  totalEarned: bigint;
  lastActivity: bigint;
  windDown: boolean;
}

// ── Read functions ────────────────────────────────────────────────────────────

export async function isViable(agentId: number | bigint): Promise<boolean> {
  const client = publicClient();
  return client.readContract({
    address: getAddress(),
    abi: ECONOMY_ABI,
    functionName: "isViable",
    args: [BigInt(agentId)],
  });
}

export async function getAccount(agentId: number | bigint): Promise<AgentAccount> {
  const client = publicClient();
  const raw = await client.readContract({
    address: getAddress(),
    abi: ECONOMY_ABI,
    functionName: "getAccount",
    args: [BigInt(agentId)],
  }) as readonly [bigint, bigint, bigint, bigint, boolean];

  return {
    balance: raw[0],
    totalSpent: raw[1],
    totalEarned: raw[2],
    lastActivity: raw[3],
    windDown: raw[4],
  };
}

// ── Write functions ───────────────────────────────────────────────────────────

export async function recordStorageCost(
  agentId: number | bigint,
  costWei: bigint,
  cid: string,
  dryRun = false
): Promise<Hash | null> {
  if (dryRun) {
    console.log(
      `[economy] dry-run — recordStorageCost(${agentId}, ${costWei} wei, ${cid})`
    );
    return null;
  }
  const wc = walletClient();
  const pc = publicClient();
  const hash = await wc.writeContract({
    address: getAddress(),
    abi: ECONOMY_ABI,
    functionName: "recordStorageCost",
    args: [BigInt(agentId), costWei, cid],
  });
  await pc.waitForTransactionReceipt({ hash });
  return hash;
}

export async function recordRevenue(
  agentId: number | bigint,
  usdCents: number | bigint,
  dryRun = false
): Promise<Hash | null> {
  if (dryRun) {
    console.log(`[economy] dry-run — recordRevenue(${agentId}, ${usdCents} usd-cents)`);
    return null;
  }
  const wc = walletClient();
  const pc = publicClient();
  const hash = await wc.writeContract({
    address: getAddress(),
    abi: ECONOMY_ABI,
    functionName: "recordRevenue",
    args: [BigInt(agentId), BigInt(usdCents)],
  });
  await pc.waitForTransactionReceipt({ hash });
  return hash;
}

export async function topUp(
  agentId: number | bigint,
  amountWei: bigint,
  dryRun = false
): Promise<Hash | null> {
  if (dryRun) {
    console.log(`[economy] dry-run — topUp(${agentId}, ${amountWei} wei)`);
    return null;
  }
  const wc = walletClient();
  const pc = publicClient();
  const hash = await wc.writeContract({
    address: getAddress(),
    abi: ECONOMY_ABI,
    functionName: "topUp",
    args: [BigInt(agentId)],
    value: amountWei,
  });
  await pc.waitForTransactionReceipt({ hash });
  return hash;
}
