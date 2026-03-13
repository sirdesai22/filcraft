import { redirect } from "next/navigation";
import type { NetworkId } from "@/lib/networks";
import { DEFAULT_NETWORK, NETWORK_IDS } from "@/lib/networks";

/**
 * Agents listing merged into marketplace. Redirect to /marketplace.
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

  redirect(`/marketplace?network=${network}`);
}
