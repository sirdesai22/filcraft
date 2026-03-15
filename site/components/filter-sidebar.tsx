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
      <p className="px-1 text-[9px] font-semibold uppercase tracking-widest text-[#a89060]/50" style={{ fontFamily: "var(--font-cinzel, Cinzel, serif)" }}>
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
          ? "bg-[rgba(245,217,106,0.08)] font-semibold text-[#f5d96a] border border-[rgba(245,217,106,0.2)]"
          : "font-normal text-[#a89060] hover:bg-[rgba(245,217,106,0.04)] hover:text-[#e8dcc8] border border-transparent"
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
