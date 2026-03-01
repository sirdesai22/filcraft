"use client";

import { EPISODE_TAGS, type EpisodeTag } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption = "newest" | "most-installed" | "price-low" | "price-high";

interface EpisodeFilterSidebarProps {
  selectedTags: EpisodeTag[];
  onTagsChange: (tags: EpisodeTag[]) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
}

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "most-installed": "Most installed",
  "price-low": "Price: Low to high",
  "price-high": "Price: High to low",
};

export function EpisodeFilterSidebar({
  selectedTags,
  onTagsChange,
  sort,
  onSortChange,
  priceRange,
  onPriceRangeChange,
}: EpisodeFilterSidebarProps) {
  const toggleTag = (tag: EpisodeTag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {EPISODE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedTags.includes(tag)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Sort by</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {SORT_LABELS[sort]}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
              <DropdownMenuItem key={opt} onClick={() => onSortChange(opt)}>
                {SORT_LABELS[opt]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Price (FIL)</h3>
        <div className="space-y-2">
          <Slider
            value={priceRange}
            onValueChange={(v) => onPriceRangeChange(v as [number, number])}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            {priceRange[0].toFixed(2)} – {priceRange[1].toFixed(2)} FIL
          </p>
        </div>
      </div>
    </div>
  );
}

interface AgentFilterSidebarProps {
  selectedTags: EpisodeTag[];
  onTagsChange: (tags: EpisodeTag[]) => void;
  showFreeOnly: boolean;
  onShowFreeOnlyChange: (v: boolean) => void;
}

export function AgentFilterSidebar({
  selectedTags,
  onTagsChange,
  showFreeOnly,
  onShowFreeOnlyChange,
}: AgentFilterSidebarProps) {
  const toggleTag = (tag: EpisodeTag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Compatibility</h3>
        <div className="flex flex-wrap gap-2">
          {EPISODE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedTags.includes(tag)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="free-only"
            checked={showFreeOnly}
            onChange={(e) => onShowFreeOnlyChange(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="free-only" className="text-sm font-normal cursor-pointer">
            Free only
          </Label>
        </div>
      </div>
    </div>
  );
}

// ── Registry Agent Filter Sidebar ────────────────────────────────────────────

const PROTOCOLS = ["all", "mcp", "a2a"] as const;
export type ProtocolFilter = (typeof PROTOCOLS)[number];

interface RegistryAgentFilterSidebarProps {
  protocol: ProtocolFilter;
  onProtocolChange: (p: ProtocolFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  network: string;
  onNetworkChange: (n: string) => void;
  networks: { id: string; name: string }[];
}

const PROTOCOL_LABELS: Record<ProtocolFilter, string> = {
  all: "All protocols",
  mcp: "MCP",
  a2a: "A2A",
};

export function RegistryAgentFilterSidebar({
  protocol,
  onProtocolChange,
  searchQuery,
  onSearchChange,
  network,
  onNetworkChange,
  networks,
}: RegistryAgentFilterSidebarProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Network</h3>
        <div className="flex flex-col gap-1.5">
          {networks.map((n) => (
            <button
              key={n.id}
              onClick={() => onNetworkChange(n.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                network === n.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {n.name}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Search</h3>
        <input
          type="text"
          placeholder="Name or address…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Protocol</h3>
        <div className="flex flex-col gap-1.5">
          {PROTOCOLS.map((p) => (
            <button
              key={p}
              onClick={() => onProtocolChange(p)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                protocol === p
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {PROTOCOL_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
