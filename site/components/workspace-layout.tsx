"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Label for mobile sidebar trigger (e.g. "Filters") */
  sidebarLabel?: string;
}

export function WorkspaceLayout({ sidebar, children, className, sidebarLabel = "Filters" }: WorkspaceLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={cn("flex min-h-[calc(100vh-3.5rem)]", className)}>
      {/* Desktop: left sidebar */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-[rgba(168,144,96,0.15)] bg-[#0a0804] md:block">
        <div className="px-4 py-5">
          {sidebar}
        </div>
      </aside>

      {/* Mobile: sidebar trigger + sheet */}
      <div className="md:hidden fixed top-14 left-0 right-0 z-40 flex items-center justify-between px-4 py-2 border-b border-[rgba(168,144,96,0.15)] bg-[#0a0804]/95 backdrop-blur">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-[rgba(168,144,96,0.3)] bg-[rgba(245,217,106,0.06)] text-[#f5d96a] hover:bg-[rgba(245,217,106,0.12)] hover:border-[rgba(245,217,106,0.4)]"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {sidebarLabel}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[280px] max-w-[85vw] border-r border-[rgba(168,144,96,0.2)] p-0"
            style={{
              background: "linear-gradient(180deg, #0a0804 0%, #120d06 100%)",
            }}
          >
            <SheetTitle className="sr-only">{sidebarLabel}</SheetTitle>
            <div className="px-4 py-5 overflow-y-auto h-full">
              {sidebar}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <main className="min-w-0 flex-1 w-full">
        <div className="px-4 py-4 pt-24 md:pt-6 md:px-8 md:py-6">{children}</div>
      </main>
    </div>
  );
}
