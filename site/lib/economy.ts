/**
 * economy.ts — AgentEconomyRegistry client for FilCraft site.
 *
 * Reads agent economy data from the AgentEconomyRegistry contract deployed on
 * Filecoin Calibration. Used by the /economy dashboard to display survival
 * rates, P&L, and recent activity.
 *
 * Contract address is set via AGENT_ECONOMY_REGISTRY_ADDRESS env var (populated
 * after running erc-8004-contracts/scripts/deploy-economy.ts).
 */

import { createPublicClient, http, parseAbi, decodeEventLog, type Log } from "viem";
import { filecoinCalibration } from "viem/chains";

// ── Contract ──────────────────────────────────────────────────────────────────

const DEFAULT_ECONOMY_REGISTRY = "0x87ca5e54a3afd16f3ff5101ffbede586bac1292a" as `0x${string}`;

export const AGENT_ECONOMY_REGISTRY_ADDRESS =
  (process.env.AGENT_ECONOMY_REGISTRY_ADDRESS as `0x${string}`) || DEFAULT_ECONOMY_REGISTRY;

export const ECONOMY_ABI = parseAbi([
  "function isViable(uint256 agentId) view returns (bool)",
  "function getAccount(uint256 agentId) view returns (uint256 balance, uint256 totalSpent, uint256 totalEarned, uint256 lastActivity, bool windDown)",
  "function MIN_VIABLE_BALANCE() view returns (uint256)",
  "event BudgetDeposited(uint256 indexed agentId, address indexed sponsor, uint256 amount)",
  "event StorageCostRecorded(uint256 indexed agentId, uint256 costWei, string cid)",
  "event RevenueRecorded(uint256 indexed agentId, uint256 usdCents)",
  "event AgentWindDown(uint256 indexed agentId, uint256 remainingBalance, string reason)",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentEconomyAccount {
  agentId: string;
  balance: string;       // wei as string
  totalSpent: string;    // wei as string
  totalEarned: string;   // USD-cents as string
  lastActivity: number;  // unix timestamp
  windDown: boolean;
  /** Derived from balance vs MIN_VIABLE_BALANCE */
  status: "healthy" | "at-risk" | "wound-down";
}

export type EconomyEventType =
  | "BudgetDeposited"
  | "StorageCostRecorded"
  | "RevenueRecorded"
  | "AgentWindDown";

export interface EconomyEvent {
  type: EconomyEventType;
  agentId: string;
  txHash: string;
  blockNumber: string;
  data: Record<string, string>;
}

// ── Client ────────────────────────────────────────────────────────────────────

function createClient() {
  return createPublicClient({
    chain: filecoinCalibration,
    transport: http(
      process.env.FILECOIN_CALIBRATION_RPC_URL ||
        "https://api.calibration.node.glif.io/rpc/v1"
    ),
  });
}

// glif.io does not support eth_getLogs; use Ankr for event queries.
function createLogsClient() {
  return createPublicClient({
    chain: filecoinCalibration,
    transport: http("https://rpc.ankr.com/filecoin_testnet"),
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_VIABLE_BALANCE = BigInt("5000000000000000"); // 0.005 tFIL in wei
// "At-risk" = between 1x and 3x the minimum
const AT_RISK_THRESHOLD = MIN_VIABLE_BALANCE * 3n;

function deriveStatus(account: {
  balance: bigint;
  windDown: boolean;
}): AgentEconomyAccount["status"] {
  if (account.windDown) return "wound-down";
  if (account.balance < MIN_VIABLE_BALANCE) return "wound-down";
  if (account.balance < AT_RISK_THRESHOLD) return "at-risk";
  return "healthy";
}

// ── Functions ─────────────────────────────────────────────────────────────────

/**
 * Fetch economy accounts for a list of agent IDs.
 * Returns a Map<agentId, AgentEconomyAccount>.
 */
export async function fetchEconomyAccounts(
  agentIds: (string | number)[]
): Promise<Map<string, AgentEconomyAccount>> {
  if (agentIds.length === 0) return new Map();

  const client = createClient();
  const results = new Map<string, AgentEconomyAccount>();

  // Batch reads — each agentId is a separate readContract call
  const reads = agentIds.map((id) =>
    client
      .readContract({
        address: AGENT_ECONOMY_REGISTRY_ADDRESS,
        abi: ECONOMY_ABI,
        functionName: "getAccount",
        args: [BigInt(id)],
      })
      .then((raw) => {
        const arr = raw as readonly [bigint, bigint, bigint, bigint, boolean];
        const account = {
          balance: arr[0],
          totalSpent: arr[1],
          totalEarned: arr[2],
          lastActivity: arr[3],
          windDown: arr[4],
        };
        results.set(String(id), {
          agentId: String(id),
          balance: account.balance.toString(),
          totalSpent: account.totalSpent.toString(),
          totalEarned: account.totalEarned.toString(),
          lastActivity: Number(account.lastActivity),
          windDown: account.windDown,
          status: deriveStatus(account),
        });
      })
      .catch(() => {
        // Agent not in registry — return empty account
        results.set(String(id), {
          agentId: String(id),
          balance: "0",
          totalSpent: "0",
          totalEarned: "0",
          lastActivity: 0,
          windDown: false,
          status: "healthy",
        });
      })
  );

  await Promise.allSettled(reads);
  return results;
}

/**
 * Fetch recent economy events from the contract logs.
 * Returns the last `limit` events across all 4 event types, newest first.
 */
export async function fetchEconomyEvents(limit = 20): Promise<EconomyEvent[]> {
  const client = createLogsClient();
  const address = AGENT_ECONOMY_REGISTRY_ADDRESS;

  // Ankr supports eth_getLogs but caps at ~200 blocks per request.
  // Fetch the last 1000 blocks in 200-block chunks (~5.5 hours at 20s/block).
  const CHUNK = 200n;
  const WINDOW = 1000n;

  let latest: bigint;
  try {
    latest = await client.getBlockNumber();
  } catch {
    return [];
  }
  const windowStart = latest > WINDOW ? latest - WINDOW : 0n;

  // Fetch all raw contract logs in 200-block chunks (Ankr's per-request limit)
  const rawLogs: Log[] = [];
  for (let from = windowStart; from <= latest; from += CHUNK) {
    const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;
    try {
      const chunk = await client.getLogs({ address, fromBlock: from, toBlock: to });
      rawLogs.push(...chunk);
    } catch {
      // skip failed chunk silently
    }
  }

  // Decode each raw log client-side against all 4 event signatures
  const events: EconomyEvent[] = [];
  for (const log of rawLogs) {
    try {
      const decoded = decodeEventLog({ abi: ECONOMY_ABI, data: log.data, topics: log.topics });
      const args = (decoded.args ?? {}) as Record<string, unknown>;
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(args)) data[k] = String(v);
      events.push({
        type: decoded.eventName as EconomyEventType,
        agentId: data.agentId ?? "0",
        txHash: log.transactionHash ?? "",
        blockNumber: String(log.blockNumber ?? 0),
        data,
      });
    } catch {
      // unknown event signature — skip
    }
  }

  events.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
  return events.slice(0, limit);
}


// ── Aggregate stats ───────────────────────────────────────────────────────────

export interface EconomySummary {
  activeAgents: number;
  atRiskAgents: number;
  windDownCount: number;
  totalStorageCostWei: string;
  totalRevenueUsdCents: string;
}

export function computeEconomySummary(
  accounts: Map<string, AgentEconomyAccount>
): EconomySummary {
  let activeAgents = 0;
  let atRiskAgents = 0;
  let windDownCount = 0;
  let totalStorageCostWei = 0n;
  let totalRevenueUsdCents = 0n;

  for (const acct of accounts.values()) {
    if (acct.status === "healthy") activeAgents++;
    else if (acct.status === "at-risk") atRiskAgents++;
    else windDownCount++;
    totalStorageCostWei += BigInt(acct.totalSpent);
    totalRevenueUsdCents += BigInt(acct.totalEarned);
  }

  return {
    activeAgents,
    atRiskAgents,
    windDownCount,
    totalStorageCostWei: totalStorageCostWei.toString(),
    totalRevenueUsdCents: totalRevenueUsdCents.toString(),
  };
}
