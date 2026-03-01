import { unstable_cache } from "next/cache";
import { fetchRegistryAgents } from "@/lib/registry";
import type { RegistryAgent } from "@/lib/registry";
import type { NetworkId } from "./networks";
import { DEFAULT_NETWORK } from "./networks";

export type ProtocolFilter = "all" | "mcp" | "a2a";

export interface GetAgentsPageParams {
  page?: number;
  pageSize?: number;
  query?: string;
  protocol?: ProtocolFilter;
  network?: NetworkId;
  noCache?: boolean;
}

export interface GetAgentsPageResult {
  items: RegistryAgent[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  network: NetworkId;
}

function getCachedAgents(networkId: NetworkId) {
  return unstable_cache(
    () => fetchRegistryAgents(networkId),
    ["registry-agents", networkId],
    { revalidate: 600, tags: ["registry-agents", `registry-agents-${networkId}`] }
  )();
}

export { getCachedAgents };

export async function getAgentsPage(
  params: GetAgentsPageParams = {}
): Promise<GetAgentsPageResult> {
  const {
    page = 1,
    pageSize = 12,
    query = "",
    protocol = "all",
    network = DEFAULT_NETWORK,
    noCache = false,
  } = params;

  let agents = noCache
    ? await fetchRegistryAgents(network)
    : await getCachedAgents(network);

  if (protocol !== "all") {
    const p = protocol.toUpperCase();
    agents = agents.filter((a) => a.protocols.includes(p));
  }

  if (query) {
    const q = query.toLowerCase();
    agents = agents.filter(
      (a) =>
        a.metadata?.name?.toLowerCase().includes(q) ||
        a.metadata?.description?.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q)
    );
  }

  const skip = (page - 1) * pageSize;
  const items = agents.slice(skip, skip + pageSize);

  return {
    items,
    page,
    pageSize,
    total: agents.length,
    hasMore: skip + pageSize < agents.length,
    network,
  };
}
