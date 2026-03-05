"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  showIncompleteAgents: boolean;
  onShowIncompleteAgentsChange: (v: boolean) => void;
}

const PROTOCOL_LABELS: Record<ProtocolFilter, string> = {
  all: "All protocols",
  mcp: "MCP",
  a2a: "A2A",
};

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </p>
      {children}
    </div>
  );
}

function SidebarNavItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-all duration-150",
        active
          ? "bg-amber-900/10 font-semibold text-amber-900 dark:bg-amber-100/10 dark:text-amber-200"
          : "font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function RegistryAgentFilterSidebar({
  protocol,
  onProtocolChange,
  searchQuery,
  onSearchChange,
  network,
  onNetworkChange,
  networks,
  showIncompleteAgents,
  onShowIncompleteAgentsChange,
}: RegistryAgentFilterSidebarProps) {
  return (
    <div className="space-y-5">
      <SidebarSection label="Network">
        <div className="flex flex-col gap-0.5">
          {networks.map((n) => (
            <SidebarNavItem
              key={n.id}
              active={network === n.id}
              onClick={() => onNetworkChange(n.id)}
            >
              {n.name}
            </SidebarNavItem>
          ))}
        </div>
      </SidebarSection>

      <Separator className="opacity-50" />

      <SidebarSection label="Search">
        <input
          type="text"
          placeholder="Name or address…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-muted/40 px-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-amber-700/50 focus:bg-background focus:outline-none focus:ring-1 focus:ring-amber-700/30 dark:focus:border-amber-400/40 dark:focus:ring-amber-400/20"
        />
      </SidebarSection>

      <Separator className="opacity-50" />

      <SidebarSection label="Protocol">
        <div className="flex flex-col gap-0.5">
          {PROTOCOLS.map((p) => (
            <SidebarNavItem
              key={p}
              active={protocol === p}
              onClick={() => onProtocolChange(p)}
            >
              {PROTOCOL_LABELS[p]}
            </SidebarNavItem>
          ))}
        </div>
      </SidebarSection>

    </div>
  );
}
