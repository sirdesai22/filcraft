import { NextRequest, NextResponse } from "next/server";
import { fetchDataListings } from "@/lib/data-marketplace";

export const dynamic = "force-dynamic";

// GET /api/data-listings?category=market-data&agentId=12
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") || undefined;
  const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
  try {
    const result = await fetchDataListings({ category, agentId });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[data-listings]", err);
    return NextResponse.json({ listings: [], total: 0 });
  }
}
