"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataListingCard } from "@/components/data-listing-card";
import type { DataListing } from "@/lib/data-marketplace";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "market-data", label: "Market Data" },
  { value: "research", label: "Research" },
  { value: "regulatory", label: "Regulatory" },
  { value: "scientific", label: "Scientific" },
  { value: "ai-intelligence", label: "AI Intelligence" },
];

interface DataListingsClientProps {
  initialListings: DataListing[];
}

export function DataListingsClient({ initialListings }: DataListingsClientProps) {
  const [listings, setListings] = useState<DataListing[]>(initialListings);
  const [category, setCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchListings = useCallback(async (cat: string) => {
    setIsLoading(true);
    try {
      const url = `/api/data-listings${cat ? `?category=${encodeURIComponent(cat)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings ?? []);
      }
    } catch {
      // keep existing listings
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings(category);
  }, [category, fetchListings]);

  return (
    <div className="space-y-6">
      {/* Filters + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              category === c.value
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto"
          onClick={() => fetchListings(category)}
          disabled={isLoading}
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Grid */}
      {listings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {isLoading ? "Loading listings…" : "No active listings found."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <DataListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {listings.length} active listing{listings.length !== 1 ? "s" : ""} ·{" "}
        <span className="font-mono">DataListingRegistry</span> on Filecoin Calibration ·
        Escrow settlement via USDC
      </p>
    </div>
  );
}
