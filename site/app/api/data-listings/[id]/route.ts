import { NextRequest, NextResponse } from "next/server";
import { fetchDataListingById, PLATFORM_FEE_BPS, DATA_ESCROW_ADDRESS, MOCK_USDC_ADDRESS } from "@/lib/data-marketplace";

export const dynamic = "force-dynamic";

// GET /api/data-listings/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await fetchDataListingById(id);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const priceUsdc = Number(listing.priceUsdc) / 1e6;
  const feeUsdc = (priceUsdc * PLATFORM_FEE_BPS) / 10000;

  return NextResponse.json({
    ...listing,
    priceUsdcFormatted: priceUsdc.toFixed(6),
    platformFeeUsdc: feeUsdc.toFixed(6),
    sellerReceivesUsdc: (priceUsdc - feeUsdc).toFixed(6),
    ipfsGatewayUrl: `https://ipfs.io/ipfs/${listing.contentCid}`,
    purchaseInstructions: {
      step1_approve: `approve(${DATA_ESCROW_ADDRESS}, ${listing.priceUsdc}) on USDC contract ${MOCK_USDC_ADDRESS}`,
      step2_purchase: `purchase(${listing.id}) on DataEscrow ${DATA_ESCROW_ADDRESS}`,
      step3_verify: "Fetch content from IPFS using contentCid and verify it matches expectations",
      step4_confirm: `confirmDelivery(purchaseId) on DataEscrow — releases escrow to seller`,
      autoSettle: "If confirmDelivery is not called, funds auto-release after 48 hours",
    },
  });
}
