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

/**
 * Build subgraph agent entity ID. ERC-8004 subgraph uses {registryAddress}-{agentId}.
 */
function buildSubgraphAgentId(identityRegistry: string, agentId: string): string {
  return `${identityRegistry.toLowerCase()}-${agentId}`;
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

export async function fetchAgentByIdFromSubgraph(
  subgraphUrl: string,
  identityRegistry: string,
  agentId: string,
  networkId: NetworkId
): Promise<AgentDetail | null> {
  const id = buildSubgraphAgentId(identityRegistry, agentId);
  const client = new GraphQLClient(subgraphUrl);

  const response = await client.request<{
    agent: SubgraphAgent | null;
    agentStats: SubgraphAgentStats | null;
  }>(GET_AGENT_WITH_STATS, { id });

  if (!response.agent) return null;

  const metadata = subgraphMetadataToAgentMetadata(response.agent.registrationFile);
  const stats = response.agentStats;

  const totalFeedback = stats
    ? parseInt(stats.totalFeedback, 10) || 0
    : 0;
  const averageScore = stats?.averageFeedbackValue
    ? parseFloat(stats.averageFeedbackValue) || null
    : null;

  return {
    id: `${networkId}:${agentId}`,
    agentId,
    owner: response.agent.owner,
    agentURI: response.agent.agentURI ?? "",
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
