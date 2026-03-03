"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InstallCommandProps {
  name: string;
  token?: string;
  registry?: string;
  className?: string;
  variant?: "default" | "parchment";
}

export function InstallCommand({
  name,
  token,
  registry = "memfil",
  className,
  variant = "default",
}: InstallCommandProps) {
  const [copied, setCopied] = useState(false);
  const command = token
    ? `pnpm add memory ${name} --token ${token} --registry ${registry}`
    : `pnpm add memory ${name} --registry ${registry}`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isParchment = variant === "parchment";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg px-3 py-2 font-mono text-sm",
        isParchment
          ? "border border-foreground/20 bg-foreground/5 text-foreground"
          : "bg-black text-white",
        className
      )}
    >
      <code className="truncate flex-1">{command}</code>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0",
              isParchment
                ? "text-foreground hover:bg-foreground/10"
                : "text-white hover:bg-white/20"
            )}
            onClick={copyToClipboard}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Copy command"}</TooltipContent>
      </Tooltip>
    </div>
  );
}
