"use client";

import { cn } from "@/lib/utils";

// ── Registry Agent Filter Sidebar ────────────────────────────────────────────

export type ProtocolFilter = "all" | "mcp" | "a2a";

interface RegistryAgentFilterSidebarProps {
  network: string;
  onNetworkChange: (n: string) => void;
  networks: { id: string; name: string }[];
}

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
  network,
  onNetworkChange,
  networks,
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
    </div>
  );
}
