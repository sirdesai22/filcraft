import { NextRequest, NextResponse } from "next/server";
import { fetchDataListings } from "@/lib/data-marketplace";

export const dynamic = "force-dynamic";

// GET /api/data-listings?category=market-data
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") || undefined;
  try {
    const result = await fetchDataListings({ category });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[data-listings]", err);
    return NextResponse.json({ listings: [], total: 0 });
  }
}
