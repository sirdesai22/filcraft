import { Suspense } from "react";
import { MarketplaceContent } from "./marketplace-content";
import { AgentsPageLoading } from "@/app/agents/agents-loading";
import type { NetworkId } from "@/lib/networks";
import { NETWORK_IDS } from "@/lib/networks";

const MARKETPLACE_DEFAULT_NETWORK: NetworkId = "filecoinCalibration";

export const dynamic = "force-dynamic";

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string }>;
}) {
  const sp = await searchParams;
  const networkParam = sp.network ?? MARKETPLACE_DEFAULT_NETWORK;
  const initialNetwork: NetworkId = NETWORK_IDS.includes(networkParam as NetworkId)
    ? (networkParam as NetworkId)
    : MARKETPLACE_DEFAULT_NETWORK;

  return (
    <Suspense fallback={<AgentsPageLoading />}>
      <MarketplaceContent initialNetwork={initialNetwork} />
    </Suspense>
  );
}
