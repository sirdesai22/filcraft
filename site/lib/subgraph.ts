import { GraphQLClient, gql } from "graphql-request";
import type { RegistryAgent, AgentDetail, AgentMetadata } from "./registry";
import type { NetworkId } from "./networks";

// Subgraph agent entity (matches ERC-8004 subgraph schema)
interface SubgraphAgent {
  id: string;
  agentId: string;
  chainId: string;
  owner: string;
  agentURI: string | null;
  createdAt: string;
  updatedAt: string;
  totalFeedback: string;
  lastActivity: string;
  registrationFile: {
    name: string | null;
    description: string | null;
    image: string | null;
    active: boolean | null;
    x402Support: boolean | null;
    supportedTrusts: string[];
    mcpEndpoint: string | null;
    mcpTools: string[];
    a2aEndpoint: string | null;
    a2aSkills: string[];
  } | null;
}

interface SubgraphAgentStats {
  totalFeedback: string;
  averageFeedbackValue: string;
}

const AGENT_FIELDS = `
  id
  agentId
  chainId
  owner
  agentURI
  createdAt
  updatedAt
  totalFeedback
  lastActivity
  registrationFile {
    name
    description
    image
    active
    x402Support
    supportedTrusts
    mcpEndpoint
    mcpTools
    a2aEndpoint
    a2aSkills
  }
`;

const GET_AGENTS = gql`
  query GetAgents($first: Int!, $skip: Int!, $orderBy: Agent_orderBy!, $orderDirection: OrderDirection!) {
    agents(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
      ${AGENT_FIELDS}
    }
  }
`;

const GET_AGENT_WITH_STATS = gql`
  query GetAgentWithStats($id: ID!) {
    agent(id: $id) {
      ${AGENT_FIELDS}
    }
    agentStats(id: $id) {
      totalFeedback
      averageFeedbackValue
    }
  }
`;

function subgraphMetadataToAgentMetadata(
  rf: SubgraphAgent["registrationFile"]
): AgentMetadata | null {
  if (!rf) return null;
  return {
    name: rf.name ?? undefined,
    description: rf.description ?? undefined,
    image: rf.image ?? undefined,
    active: rf.active ?? undefined,
    x402Support: rf.x402Support ?? undefined,
    supportedTrusts: rf.supportedTrusts ?? [],
    mcpEndpoint: rf.mcpEndpoint ?? undefined,
    mcpTools: rf.mcpTools ?? [],
    a2aEndpoint: rf.a2aEndpoint ?? undefined,
    a2aSkills: rf.a2aSkills ?? [],
  };
}

function getProtocols(metadata: AgentMetadata | null): string[] {
  if (!metadata) return ["CUSTOM"];
  const p: string[] = [];
  if (metadata.mcpEndpoint) p.push("MCP");
  if (metadata.a2aEndpoint) p.push("A2A");
  return p.length ? p : ["CUSTOM"];
}

function subgraphAgentToRegistryAgent(
  a: SubgraphAgent,
  networkId: NetworkId
): RegistryAgent {
  const metadata = subgraphMetadataToAgentMetadata(a.registrationFile);
  return {
    id: `${networkId}:${a.agentId}`,
    agentId: a.agentId,
    owner: a.owner,
    agentURI: a.agentURI ?? "",
    blockNumber: "0",
    metadata,
    protocols: getProtocols(metadata),
    networkId,
  };
}

function buildSubgraphAgentId(chainId: number, agentId: string): string {
  return `${chainId}:${agentId}`;
}

const SUBGRAPH_PAGE_SIZE = 500;

export async function fetchAgentsFromSubgraph(
  subgraphUrl: string,
  networkId: NetworkId
): Promise<RegistryAgent[]> {
  const client = new GraphQLClient(subgraphUrl);
  const orderBy = "createdAt";
  const orderDirection = "desc";

  const allAgents: RegistryAgent[] = [];
  let skip = 0;

  while (true) {
    const response = await client.request<{ agents: SubgraphAgent[] }>(
      GET_AGENTS,
      {
        first: SUBGRAPH_PAGE_SIZE,
        skip,
        orderBy,
        orderDirection,
      }
    );

    const batch = response.agents.map((a) =>
      subgraphAgentToRegistryAgent(a, networkId)
    );
    allAgents.push(...batch);

    if (batch.length < SUBGRAPH_PAGE_SIZE) break;
    skip += SUBGRAPH_PAGE_SIZE;
  }

  return allAgents;
}

const GET_AGENT_ONLY = gql`
  query GetAgent($id: ID!) {
    agent(id: $id) {
      ${AGENT_FIELDS}
    }
  }
`;

// Minimal fallback — only fields confirmed to exist across all deployments
const GET_AGENT_MINIMAL = gql`
  query GetAgentMinimal($id: ID!) {
    agent(id: $id) {
      id
      agentId
      chainId
      owner
      agentURI
    }
  }
`;

export async function fetchAgentByIdFromSubgraph(
  subgraphUrl: string,
  agentId: string,
  networkId: NetworkId,
  chainId: number
): Promise<AgentDetail | null> {
  const id = buildSubgraphAgentId(chainId, agentId);
  const client = new GraphQLClient(subgraphUrl);

  // Try progressively simpler queries until one works
  let subgraphAgent: SubgraphAgent | null = null;
  let stats: SubgraphAgentStats | null = null;

  try {
    const response = await client.request<{
      agent: SubgraphAgent | null;
      agentStats: SubgraphAgentStats | null;
    }>(GET_AGENT_WITH_STATS, { id });
    subgraphAgent = response.agent;
    stats = response.agentStats;
  } catch {
    try {
      const response = await client.request<{ agent: SubgraphAgent | null }>(
        GET_AGENT_ONLY,
        { id }
      );
      subgraphAgent = response.agent;
    } catch {
      // Schema may not support all AGENT_FIELDS — fall back to minimal query
      try {
        const response = await client.request<{ agent: SubgraphAgent | null }>(
          GET_AGENT_MINIMAL,
          { id }
        );
        subgraphAgent = response.agent;
      } catch {
        return null;
      }
    }
  }

  if (!subgraphAgent) return null;
  const agent = subgraphAgent;
  const metadata = subgraphMetadataToAgentMetadata(agent.registrationFile);

  const totalFeedback = stats
    ? parseInt(stats.totalFeedback, 10) || 0
    : 0;
  const averageScore = stats?.averageFeedbackValue
    ? parseFloat(stats.averageFeedbackValue) || null
    : null;

  return {
    id: `${networkId}:${agentId}`,
    agentId,
    owner: agent.owner,
    agentURI: agent.agentURI ?? "",
    blockNumber: "0",
    metadata,
    protocols: getProtocols(metadata),
    networkId,
    reputation: {
      totalFeedback,
      averageScore,
    },
  };
}

// ---------------------------------------------------------------------------
// Goldsky instant subgraph adapter (Filecoin Calibration)
// Goldsky auto-generates entities from events:
//   registereds  ← Registered(uint256 agentId, string agentURI, address owner)
//   uriupdateds  ← URIUpdated(uint256 agentId, string newURI, address updatedBy)
// ---------------------------------------------------------------------------

interface GoldskyRegistered {
  agentId: string;
  agentURI: string;
  owner: string;
  block_number: string;
}

interface GoldskyURIUpdated {
  agentId: string;
  newURI: string;
  block_number: string;
}

interface GoldskyNewFeedback {
  agentId: string;
  clientAddress: string;
  feedbackIndex: string;
  value: string;
  valueDecimals: string;
  block_number: string;
}

interface GoldskyFeedbackRevoked {
  agentId: string;
  clientAddress: string;
  feedbackIndex: string;
  block_number: string;
}

const GOLDSKY_GET_REGISTEREDS = gql`
  query GetRegistereds($first: Int!, $skip: Int!) {
    registereds(first: $first, skip: $skip, orderBy: block_number, orderDirection: desc) {
      agentId
      agentURI
      owner
      block_number
    }
  }
`;

const GOLDSKY_GET_URI_UPDATEDS = gql`
  query GetURIUpdateds($first: Int!, $skip: Int!) {
    uriupdateds(first: $first, skip: $skip, orderBy: block_number, orderDirection: desc) {
      agentId
      newURI
      block_number
    }
  }
`;

const GOLDSKY_GET_AGENT = gql`
  query GetAgent($agentId: String!) {
    registereds(where: { agentId: $agentId }, orderBy: block_number, orderDirection: asc, first: 1) {
      agentId
      agentURI
      owner
      block_number
    }
    uriupdateds(where: { agentId: $agentId }, orderBy: block_number, orderDirection: desc, first: 1) {
      agentId
      newURI
      block_number
    }
  }
`;

const GOLDSKY_GET_OWNER = gql`
  query GetOwner($agentId: String!) {
    registereds(where: { agentId: $agentId }, orderBy: block_number, orderDirection: asc, first: 1) {
      owner
    }
  }
`;

export async function fetchOwnerFromGoldskySubgraph(
  subgraphUrl: string,
  agentId: string
): Promise<string | null> {
  const client = new GraphQLClient(subgraphUrl);
  const res = await client.request<{ registereds: { owner: string }[] }>(
    GOLDSKY_GET_OWNER,
    { agentId }
  );
  return res.registereds[0]?.owner ?? null;
}

const GOLDSKY_GET_FEEDBACK = gql`
  query GetFeedback($agentId: String!) {
    newfeedbacks(where: { agentId: $agentId }) {
      agentId
      clientAddress
      feedbackIndex
      value
      valueDecimals
      block_number
    }
    feedbackrevokeds(where: { agentId: $agentId }) {
      agentId
      clientAddress
      feedbackIndex
      block_number
    }
  }
`;

const GOLDSKY_PAGE_SIZE = 1000;

function resolveURI(uri: string): string {
  return uri.startsWith("ipfs://")
    ? uri.replace("ipfs://", "https://ipfs.io/ipfs/")
    : uri;
}

async function fetchMetadata(uri: string): Promise<AgentMetadata | null> {
  if (!uri) return null;
  const resolved = resolveURI(uri);
  // If the URI is HTTPS, also try HTTP as a fallback (e.g. Akash ingress with self-signed cert)
  const urls = [resolved];
  if (resolved.startsWith("https://") && !resolved.startsWith("https://ipfs.io")) {
    urls.push(resolved.replace("https://", "http://"));
  }
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 300 },
      } as RequestInit);
      if (res.ok) return (await res.json()) as AgentMetadata;
    } catch {
      // try next URL
    }
  }
  return null;
}

export async function fetchAgentsFromGoldskySubgraph(
  subgraphUrl: string,
  networkId: NetworkId
): Promise<RegistryAgent[]> {
  const client = new GraphQLClient(subgraphUrl);

  // Paginate Registered events
  const allRegistered: GoldskyRegistered[] = [];
  let skip = 0;
  while (true) {
    const res = await client.request<{ registereds: GoldskyRegistered[] }>(
      GOLDSKY_GET_REGISTEREDS,
      { first: GOLDSKY_PAGE_SIZE, skip }
    );
    allRegistered.push(...res.registereds);
    if (res.registereds.length < GOLDSKY_PAGE_SIZE) break;
    skip += GOLDSKY_PAGE_SIZE;
  }

  // Paginate URIUpdated events
  const allURIUpdated: GoldskyURIUpdated[] = [];
  skip = 0;
  while (true) {
    const res = await client.request<{ uriupdateds: GoldskyURIUpdated[] }>(
      GOLDSKY_GET_URI_UPDATEDS,
      { first: GOLDSKY_PAGE_SIZE, skip }
    );
    allURIUpdated.push(...res.uriupdateds);
    if (res.uriupdateds.length < GOLDSKY_PAGE_SIZE) break;
    skip += GOLDSKY_PAGE_SIZE;
  }

  // Build latest URI per agentId
  const latestURI = new Map<string, { uri: string; blockNumber: bigint }>();
  for (const e of allRegistered) {
    const bn = BigInt(e.block_number);
    const curr = latestURI.get(e.agentId);
    if (!curr || bn >= curr.blockNumber)
      latestURI.set(e.agentId, { uri: e.agentURI, blockNumber: bn });
  }
  for (const e of allURIUpdated) {
    const bn = BigInt(e.block_number);
    const curr = latestURI.get(e.agentId);
    if (!curr || bn > curr.blockNumber)
      latestURI.set(e.agentId, { uri: e.newURI, blockNumber: bn });
  }

  // Deduplicate: keep earliest registration per agentId for owner/blockNumber
  const agentMap = new Map<string, { owner: string; blockNumber: bigint }>();
  for (const e of allRegistered) {
    const bn = BigInt(e.block_number);
    const curr = agentMap.get(e.agentId);
    if (!curr || bn < curr.blockNumber)
      agentMap.set(e.agentId, { owner: e.owner, blockNumber: bn });
  }

  // Sort newest-first, fetch metadata in parallel
  const sorted = [...agentMap.entries()].sort(
    ([, a], [, b]) => (b.blockNumber > a.blockNumber ? 1 : -1)
  );

  const results = await Promise.allSettled(
    sorted.map(async ([agentId, { owner, blockNumber }]) => {
      const uri = latestURI.get(agentId)?.uri ?? "";
      const metadata = await fetchMetadata(uri);
      return {
        id: `${networkId}:${agentId}`,
        agentId,
        owner,
        agentURI: uri,
        blockNumber: blockNumber.toString(),
        metadata,
        protocols: getProtocols(metadata),
        networkId,
      } satisfies RegistryAgent;
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<RegistryAgent> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}

export async function fetchAgentByIdFromGoldskySubgraph(
  subgraphUrl: string,
  agentId: string,
  networkId: NetworkId,
  reputationSubgraphUrl?: string
): Promise<AgentDetail | null> {
  const client = new GraphQLClient(subgraphUrl);

  const res = await client.request<{
    registereds: GoldskyRegistered[];
    uriupdateds: GoldskyURIUpdated[];
  }>(GOLDSKY_GET_AGENT, { agentId });

  if (!res.registereds.length) return null;

  const reg = res.registereds[0];
  let agentURI = reg.agentURI;
  if (res.uriupdateds.length > 0) {
    const update = res.uriupdateds[0];
    if (BigInt(update.block_number) > BigInt(reg.block_number))
      agentURI = update.newURI;
  }

  const metadata = await fetchMetadata(agentURI);

  // Fetch reputation from dedicated Goldsky ReputationRegistry subgraph when available.
  // Uses a separate client so the identity-registry subgraph URL is not queried for
  // entities it doesn't have (which would silently return empty results).
  let reputation = { totalFeedback: 0, averageScore: null as number | null };
  if (reputationSubgraphUrl) {
    try {
      const repClient = new GraphQLClient(reputationSubgraphUrl);
      const feedbackRes = await repClient.request<{
        newfeedbacks?: GoldskyNewFeedback[];
        feedbackrevokeds?: GoldskyFeedbackRevoked[];
      }>(GOLDSKY_GET_FEEDBACK, { agentId });
      const feedbacks = feedbackRes.newfeedbacks ?? [];
      const revoked = feedbackRes.feedbackrevokeds ?? [];
      const revokedSet = new Set(
        revoked.map((r) => `${r.clientAddress}-${r.feedbackIndex}`)
      );
      const activeFeedbacks = feedbacks.filter(
        (f) => !revokedSet.has(`${f.clientAddress}-${f.feedbackIndex}`)
      );
      if (activeFeedbacks.length > 0) {
        let sum = 0;
        for (const f of activeFeedbacks) {
          const decimals = parseInt(f.valueDecimals, 10) || 0;
          sum += parseInt(f.value, 10) / Math.pow(10, decimals);
        }
        reputation = {
          totalFeedback: activeFeedbacks.length,
          averageScore: sum / activeFeedbacks.length,
        };
      }
    } catch {
      // Subgraph may still be indexing; caller will fall back to RPC
    }
  }

  return {
    id: `${networkId}:${agentId}`,
    agentId,
    owner: reg.owner,
    agentURI,
    blockNumber: reg.block_number,
    metadata,
    protocols: getProtocols(metadata),
    networkId,
    reputation,
  };
}
