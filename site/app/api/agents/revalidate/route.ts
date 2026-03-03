import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { NETWORK_IDS, type NetworkId } from "@/lib/networks";

/**
 * Revalidates the agent detail cache so fresh on-chain data (e.g. new feedback) is fetched.
 * Called after submitting feedback to ensure the UI shows updated reputation stats.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, network } = body as { id?: string; network?: string };

    if (!id || typeof id !== "string" || !network || typeof network !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing id or network" },
        { status: 400 }
      );
    }

    if (!NETWORK_IDS.includes(network as NetworkId)) {
      return NextResponse.json(
        { success: false, error: "Invalid network" },
        { status: 400 }
      );
    }

    revalidateTag(`agent-${id}-${network}`, "max");
    revalidateTag(`agent-${id}`, "max");
    revalidateTag("agent-detail", "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Revalidate API]", error);
    return NextResponse.json(
      { success: false, error: "Revalidation failed" },
      { status: 500 }
    );
  }
}
