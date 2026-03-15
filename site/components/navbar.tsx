"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Wallet, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const NAV_LINKS: Array<{ href: string; label: string; exact: boolean; live?: boolean }> = [
  { href: "/", label: "World", exact: true },
  { href: "/marketplace", label: "Marketplace", exact: false },
  { href: "/economy", label: "Economy", exact: false },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  // Avoid hydration mismatch: wagmi state (address, isConnected) differs between server and client.
  // Server has no wallet; client may have one from localStorage. Render wallet UI only after mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  const connectWalletClass =
    "rounded-full px-5 font-medium transition-all duration-200 hover:opacity-90 border border-[rgba(245,217,106,0.3)] bg-[rgba(245,217,106,0.08)] text-[#f5d96a] hover:bg-[rgba(245,217,106,0.15)] hover:border-[rgba(245,217,106,0.5)]";

  return (
    <header
      className="sticky top-0 z-50 w-full backdrop-blur"
      style={{
        background: "linear-gradient(180deg, rgba(15,10,5,0.97), rgba(10,8,4,0.95))",
        borderBottom: "1px solid rgba(245,217,106,0.15)",
        boxShadow: "0 2px 20px rgba(0,0,0,0.4), 0 1px 0 rgba(245,217,106,0.08) inset",
      }}
    >
      <div className="container flex h-14 items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-[3px] uppercase"
          style={{
            fontFamily: "Cinzel, serif",
            color: "#f5d96a",
            textShadow: "0 0 16px rgba(245,217,106,0.4), 0 1px 2px rgba(0,0,0,0.6)",
          }}
        >
          FilCraft
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
                style={{
                  fontFamily: "Cinzel, serif",
                  color: active ? "#f5d96a" : "#a89060",
                  textShadow: active ? "0 0 10px rgba(245,217,106,0.35)" : "none",
                  borderBottom: active ? "1px solid rgba(245,217,106,0.5)" : "1px solid transparent",
                  paddingBottom: "2px",
                  letterSpacing: "1.5px",
                }}
              >
                {link.live && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            {mounted && isConnected && address ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="default"
                    className={connectWalletClass}
                  >
                    <Wallet className="size-4" />
                    {truncateAddress(address)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => disconnect()}
                  >
                    <LogOut className="size-4" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                size="default"
                className={connectWalletClass}
                onClick={() => connect({ connector: connectors[0] })}
                disabled={isConnecting}
              >
                <Wallet className="size-4" />
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </Button>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" style={{ color: "#a89060" }}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[280px] border-l"
              style={{
                background: "linear-gradient(180deg, #0f0a05, #1a1510)",
                borderColor: "rgba(245,217,106,0.15)",
              }}
            >
              <nav className="flex flex-col gap-4 pt-8">
                {NAV_LINKS.map((link) => {
                  const active = isActive(pathname, link.href, link.exact);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 text-base font-medium transition-colors"
                      style={{
                        fontFamily: "Cinzel, serif",
                        color: active ? "#f5d96a" : "#a89060",
                        textShadow: active ? "0 0 10px rgba(245,217,106,0.35)" : "none",
                        letterSpacing: "1.5px",
                      }}
                    >
                      {link.live && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                      {link.label}
                    </Link>
                  );
                })}
                {mounted && isConnected && address ? (
                  <Button
                    variant="outline"
                    className="mt-4 w-full rounded-full border-[rgba(245,217,106,0.3)] bg-[rgba(245,217,106,0.08)] text-[#f5d96a] hover:bg-[rgba(245,217,106,0.15)]"
                    size="default"
                    onClick={() => {
                      disconnect();
                      setOpen(false);
                    }}
                  >
                    <LogOut className="size-4" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    className="mt-4 w-full rounded-full border border-[rgba(245,217,106,0.3)] bg-[rgba(245,217,106,0.08)] text-[#f5d96a] hover:bg-[rgba(245,217,106,0.15)]"
                    size="default"
                    onClick={() => {
                      connect({ connector: connectors[0] });
                      setOpen(false);
                    }}
                    disabled={isConnecting}
                  >
                    <Wallet className="size-4" />
                    {isConnecting ? "Connecting…" : "Connect wallet"}
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
