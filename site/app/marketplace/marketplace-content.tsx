import { getAgentsPage } from "@/lib/agents";
import { MarketplaceClient } from "./marketplace-client";
import type { NetworkId } from "@/lib/networks";

export async function MarketplaceContent({ initialNetwork }: { initialNetwork: NetworkId }) {
  const initialData = await getAgentsPage({
    page: 1,
    pageSize: 12,
    protocol: "all",
    query: "",
    network: initialNetwork,
    noCache: initialNetwork === "filecoinCalibration",
  });

  return <MarketplaceClient initialData={initialData} initialNetwork={initialNetwork} />;
}
