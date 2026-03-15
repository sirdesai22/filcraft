import { redirect } from "next/navigation";
import { NETWORK_IDS, type NetworkId } from "@/lib/networks";

/**
 * Agent detail page removed — all functionality moved to AgentDetailPanel.
 * Redirect to economy (Filecoin) or marketplace with agent param to open the panel.
 */
export default async function AgentDetailRedirect({
  params,
}: {
  params: Promise<{ network: string; id: string }>;
}) {
  const { network, id } = await params;
  const networkId: NetworkId = NETWORK_IDS.includes(network as NetworkId)
    ? (network as NetworkId)
    : "sepolia";

  if (networkId === "filecoinCalibration") {
    redirect(`/economy?agent=${id}&network=${networkId}`);
  }
  redirect(`/marketplace?agent=${id}&network=${networkId}`);
}
