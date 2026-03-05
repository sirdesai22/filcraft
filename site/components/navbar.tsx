"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/marketplace", label: "Marketplace", exact: false },
  { href: "/agents", label: "Agent Registry", exact: true },
  { href: "/agents/register", label: "Register Agent", exact: false },
  { href: "/explore", label: "Skills", exact: false },
  { href: "/docs", label: "Docs", exact: false },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-playfair-display), serif" }}
        >
          Memfil
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                isActive(pathname, link.href, link.exact)
                  ? "text-foreground underline underline-offset-4"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Button
            asChild
            className="hidden rounded-full px-5 md:flex"
            size="default"
          >
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub →
            </a>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <nav className="flex flex-col gap-4 pt-8">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "text-base font-medium",
                      isActive(pathname, link.href, link.exact)
                        ? "text-foreground underline underline-offset-4"
                        : "text-muted-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <Button asChild className="mt-4 rounded-full" size="default">
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    GitHub →
                  </a>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
