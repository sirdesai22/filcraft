import { Suspense } from "react";
import { AgentsContent } from "./agents-content";
import { AgentsPageLoading } from "./agents-loading";
import type { NetworkId } from "@/lib/networks";
import { DEFAULT_NETWORK, NETWORK_IDS } from "@/lib/networks";

// RPC fetch is slow; avoid prerender timeout during build
export const dynamic = "force-dynamic";

/**
 * Agents page with server-side initial fetch + Suspense.
 * First paint uses cached data from server (like erc-8004-agents-explorer-demo).
 */
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string }>;
}) {
  const params = await searchParams;
  const networkParam = params.network || DEFAULT_NETWORK;
  const network: NetworkId = NETWORK_IDS.includes(networkParam as NetworkId)
    ? (networkParam as NetworkId)
    : DEFAULT_NETWORK;

  return (
    <Suspense fallback={<AgentsPageLoading />}>
      <AgentsContent initialNetwork={network} />
    </Suspense>
  );
}
