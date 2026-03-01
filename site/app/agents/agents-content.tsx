import { getAgentsPage } from "@/lib/agents";
import { AgentsPageClient } from "./agents-client";
import type { NetworkId } from "@/lib/networks";

/**
 * Server component that fetches initial agents data.
 * Enables fast first paint via server-side cache (like erc-8004-agents-explorer-demo subgraph).
 */
export async function AgentsContent({
  initialNetwork,
}: {
  initialNetwork: NetworkId;
}) {
  const initialData = await getAgentsPage({
    page: 1,
    pageSize: 12,
    protocol: "all",
    query: "",
    network: initialNetwork,
    noCache: initialNetwork === "filecoinCalibration",
  });

  return (
    <AgentsPageClient
      initialData={initialData}
      initialNetwork={initialNetwork}
    />
  );
}
