import { createPublicClient, http, parseAbiItem, parseAbi } from "viem";
import type { PublicClient } from "viem";
import type { NetworkId } from "./networks";
import { getNetwork } from "./networks";
import {
  fetchAgentsFromSubgraph,
  fetchAgentByIdFromSubgraph,
  fetchAgentsFromGoldskySubgraph,
  fetchAgentByIdFromGoldskySubgraph,
} from "./subgraph";

const IDENTITY_READ_ABI = parseAbi([
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

const REPUTATION_ABI = parseAbi([
  "function getClients(uint256 agentId) view returns (address[])",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
]);

export interface AgentMetadata {
  name?: string;
  description?: string;
  image?: string;
  active?: boolean;
  x402Support?: boolean;
  supportedTrusts?: string[];
  mcpEndpoint?: string;
  mcpTools?: string[];
  a2aEndpoint?: string;
  a2aSkills?: string[];
}

export interface RegistryAgent {
  id: string;
  agentId: string;
  owner: string;
  agentURI: string;
  blockNumber: string;
  metadata: AgentMetadata | null;
  protocols: string[];
  networkId: NetworkId;
}

function createClient(networkId: NetworkId): PublicClient {
  const config = getNetwork(networkId);
  const rpcUrl =
    process.env[`${networkId.replace(/([A-Z])/g, "_$1").toUpperCase()}_RPC`] ||
    config.chain.rpcUrls.default.http[0];
  return createPublicClient({
    chain: config.chain,
    transport: http(rpcUrl),
  });
}

// --- RPC helpers -----------------------------------------------------------

const CHUNK_SIZE = 9_000n;
const BATCH = 10; // parallel chunks per batch (lower to avoid RPC rate limits)

/**
 * Binary-search for the block at which `address` was first deployed.
 * O(log n) sequential eth_getCode calls, much cheaper than scanning from 0.
 * For chains with RPC lookback limits (e.g. Filecoin), minBlock restricts the search.
 */
async function findDeployBlock(
  client: PublicClient,
  address: `0x${string}`,
  latestBlock: bigint,
  minBlock: bigint = 0n
): Promise<bigint> {
  let lo = minBlock;
  let hi = latestBlock;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const code = await client.getCode({ address, blockNumber: mid });
    if (code && code !== "0x") {
      hi = mid;
    } else {
      lo = mid + 1n;
    }
  }
  return lo;
}

const REGISTERED_EVENT = parseAbiItem(
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"
);
const URI_UPDATED_EVENT = parseAbiItem(
  "event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)"
);

/**
 * Fetch logs for one event type across [fromBlock, toBlock], splitting into
 * CHUNK_SIZE-block ranges and batching BATCH chunks at a time.
 * When maxChunkSize is set (e.g. for RPC lookback limits), use it instead of CHUNK_SIZE.
 */
async function getLogsChunked(
  client: PublicClient,
  identityRegistry: `0x${string}`,
  event: typeof REGISTERED_EVENT | typeof URI_UPDATED_EVENT,
  fromBlock: bigint,
  toBlock: bigint,
  maxChunkSize?: number
) {
  const chunkSize = maxChunkSize != null ? BigInt(maxChunkSize) : CHUNK_SIZE;
  const chunks: [bigint, bigint][] = [];
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = start + chunkSize - 1n;
    chunks.push([start, end < toBlock ? end : toBlock]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allLogs: any[] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(([from, to]) =>
        client.getLogs({
          address: identityRegistry,
          event,
          fromBlock: from,
          toBlock: to,
        })
      )
    );
    allLogs.push(...results.flat());
  }
  return allLogs;
}

// --- Metadata helpers -------------------------------------------------------

function resolveURI(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return uri;
}

async function fetchMetadata(uri: string): Promise<AgentMetadata | null> {
  if (!uri) return null;
  try {
    const res = await fetch(resolveURI(uri), { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as AgentMetadata;
  } catch {
    return null;
  }
}

function getProtocols(metadata: AgentMetadata | null): string[] {
  if (!metadata) return ["CUSTOM"];
  const p: string[] = [];
  if (metadata.mcpEndpoint) p.push("MCP");
  if (metadata.a2aEndpoint) p.push("A2A");
  return p.length ? p : ["CUSTOM"];
}

// --- Public API -------------------------------------------------------------

export async function fetchRegistryAgents(
  networkId: NetworkId
): Promise<RegistryAgent[]> {
  const config = getNetwork(networkId);

  // Filecoin Calibration: Goldsky subgraph only — no RPC fallback
  if (networkId === "filecoinCalibration") {
    return fetchAgentsFromGoldskySubgraph(config.subgraphUrl!, networkId);
  }

  // Use subgraph when available (faster than RPC)
  if (config.subgraphUrl) {
    try {
      return await fetchAgentsFromSubgraph(config.subgraphUrl, networkId);
    } catch (e) {
      console.warn(
        `Subgraph fetch failed for ${networkId}, falling back to RPC:`,
        e
      );
    }
  }

  const client = createClient(networkId);
  const { identityRegistry, maxLookbackBlocks } = config;

  const latestBlock = await client.getBlockNumber();
  const minBlock =
    maxLookbackBlocks != null
      ? latestBlock > BigInt(maxLookbackBlocks)
        ? latestBlock - BigInt(maxLookbackBlocks)
        : 0n
      : 0n;
  const deployBlock = await findDeployBlock(
    client,
    identityRegistry,
    latestBlock,
    minBlock
  );

  const chunkSize = maxLookbackBlocks ?? undefined;
  const [registeredLogs, uriUpdatedLogs] = await Promise.all([
    getLogsChunked(
      client,
      identityRegistry,
      REGISTERED_EVENT,
      deployBlock,
      latestBlock,
      chunkSize
    ),
    getLogsChunked(
      client,
      identityRegistry,
      URI_UPDATED_EVENT,
      deployBlock,
      latestBlock,
      chunkSize
    ),
  ]);

  // Build latest URI map per agent
  const latestURI = new Map<string, { uri: string; blockNumber: bigint }>();

  for (const log of registeredLogs) {
    const id = log.args.agentId.toString();
    const bn: bigint = log.blockNumber ?? 0n;
    const curr = latestURI.get(id);
    if (!curr || bn >= curr.blockNumber) {
      latestURI.set(id, { uri: log.args.agentURI, blockNumber: bn });
    }
  }
  for (const log of uriUpdatedLogs) {
    const id = log.args.agentId.toString();
    const bn: bigint = log.blockNumber ?? 0n;
    const curr = latestURI.get(id);
    if (!curr || bn > curr.blockNumber) {
      latestURI.set(id, { uri: log.args.newURI, blockNumber: bn });
    }
  }

  // Unique agents sorted newest-first
  const seen = new Set<string>();
  const agents: { agentId: bigint; owner: string; blockNumber: bigint }[] = [];
  for (const log of registeredLogs) {
    const id = log.args.agentId.toString();
    if (!seen.has(id)) {
      seen.add(id);
      agents.push({
        agentId: log.args.agentId,
        owner: log.args.owner,
        blockNumber: log.blockNumber ?? 0n,
      });
    }
  }
  agents.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));

  // Fetch metadata in parallel
  const results = await Promise.allSettled(
    agents.map(async (agent) => {
      const id = agent.agentId.toString();
      const uri = latestURI.get(id)?.uri ?? "";
      const metadata = await fetchMetadata(uri);
      return {
        id: `${networkId}:${id}`,
        agentId: id,
        owner: agent.owner,
        agentURI: uri,
        blockNumber: agent.blockNumber.toString(),
        metadata,
        protocols: getProtocols(metadata),
        networkId: networkId as NetworkId,
      } satisfies RegistryAgent;
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<RegistryAgent> => r.status === "fulfilled"
    )
    .map((r) => r.value) as RegistryAgent[];
}

// --- Single agent with reputation ------------------------------------------

export interface AgentReputation {
  totalFeedback: number;
  averageScore: number | null;
}

export interface AgentDetail extends RegistryAgent {
  reputation: AgentReputation;
}

export async function fetchAgentById(
  agentId: string,
  networkId: NetworkId
): Promise<AgentDetail | null> {
  const config = getNetwork(networkId);

  // Filecoin Calibration: Goldsky subgraph only — no RPC fallback
  if (networkId === "filecoinCalibration") {
    return fetchAgentByIdFromGoldskySubgraph(config.subgraphUrl!, agentId, networkId);
  }

  // Use subgraph when available (faster than RPC)
  if (config.subgraphUrl) {
    try {
      const agent = await fetchAgentByIdFromSubgraph(
        config.subgraphUrl,
        config.identityRegistry,
        agentId,
        networkId
      );
      if (agent) return agent;
    } catch (e) {
      console.warn(
        `Subgraph fetch failed for agent ${agentId} on ${networkId}, falling back to RPC:`,
        e
      );
    }
  }

  const client = createClient(networkId);
  const { identityRegistry, reputationRegistry } = config;

  try {
    const id = BigInt(agentId);

    // Read current URI and owner directly from contract (no log scanning needed)
    const [uri, owner] = await Promise.all([
      client.readContract({
        address: identityRegistry,
        abi: IDENTITY_READ_ABI,
        functionName: "tokenURI",
        args: [id],
      }),
      client.readContract({
        address: identityRegistry,
        abi: IDENTITY_READ_ABI,
        functionName: "ownerOf",
        args: [id],
      }),
    ]);

    const [metadata, clients] = await Promise.all([
      fetchMetadata(uri),
      client.readContract({
        address: reputationRegistry,
        abi: REPUTATION_ABI,
        functionName: "getClients",
        args: [id],
      }),
    ]);

    let reputation: AgentReputation = { totalFeedback: 0, averageScore: null };

    if (clients.length > 0) {
      const summary = await client.readContract({
        address: reputationRegistry,
        abi: REPUTATION_ABI,
        functionName: "getSummary",
        args: [id, clients, "", ""],
      });
      // summary is { count: bigint, summaryValue: bigint, summaryValueDecimals: number }
      const [count, summaryValue, summaryValueDecimals] = summary;
      const total = Number(count);
      reputation = {
        totalFeedback: total,
        averageScore:
          total > 0
            ? Number(summaryValue) / Math.pow(10, summaryValueDecimals)
            : null,
      };
    }

    return {
      id: `${networkId}:${agentId}`,
      agentId,
      owner,
      agentURI: uri,
      blockNumber: "0",
      metadata,
      protocols: getProtocols(metadata),
      networkId,
      reputation,
    };
  } catch (e) {
    console.error(`fetchAgentById(${agentId}, ${networkId}) failed:`, e);
    return null;
  }
}
