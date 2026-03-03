"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import type { Memory, Agent } from "@/lib/data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InstallCommand } from "@/components/install-command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type PaymentModalItem = { type: "memory"; data: Memory } | { type: "agent"; data: Agent };

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PaymentModalItem | null;
}

function generateToken(): string {
  return `em_${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(2, 15)}`;
}

export function PaymentModal({ open, onOpenChange, item }: PaymentModalProps) {
  const [state, setState] = useState<"initial" | "processing" | "success">("initial");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setState("initial");
      setToken(null);
    }
  }, [open]);

  const handlePay = () => {
    const isFree = item?.type === "agent" && item.data.price === "free";
    if (isFree) {
      setToken(generateToken());
      setState("success");
      return;
    }
    setState("processing");
    setTimeout(() => {
      setToken(generateToken());
      setState("success");
    }, 2000);
  };

  const name = item?.type === "memory" ? item.data.name : item?.data.name;
  const price = item?.type === "memory" ? item.data.price : (item?.data.price === "free" ? "Free" : item?.data.price);
  const installName = item?.type === "memory" ? item.data.id : item?.data.id ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md bg-background"
        style={{ fontFamily: "var(--font-geist-sans)" }}
      >
        <DialogHeader>
          <DialogTitle
            className="font-display text-xl"
            style={{ fontFamily: "var(--font-playfair-display), serif" }}
          >
            {name}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {state === "initial" && (
            <motion.div
              key="initial"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {price === "Free" ? "Free" : `${price} FIL`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {price === "Free" ? "No payment required" : "One-time payment"}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <svg
                    className="h-6 w-6 text-primary"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
              </div>

              {price !== "Free" && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Wallet</p>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Connect wallet or paste address
                    </div>
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    Powered by Coinbase Commerce · Filecoin network
                  </p>
                </>
              )}

              <Button
                className="w-full rounded-full"
                onClick={handlePay}
              >
                {price === "Free" ? "Add Agent" : "Pay with FIL"}
              </Button>
            </motion.div>
          )}

          {state === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">
                Processing payment...
              </p>
            </motion.div>
          )}

          {state === "success" && token && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center py-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Check className="h-8 w-8" />
                </motion.div>
                <p className="mt-4 text-lg font-semibold text-foreground">
                  Payment complete!
                </p>
                <p className="text-sm text-muted-foreground">
                  Your memory is ready to install.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Install command</p>
                {installName && (
                  <InstallCommand
                    name={installName}
                    token={token}
                  />
                )}
              </div>

              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 rounded-full">
                      Add to Agent
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56">
                    <DropdownMenuItem>ReasonerX</DropdownMenuItem>
                    <DropdownMenuItem>CodePilot</DropdownMenuItem>
                    <DropdownMenuItem>VisionAgent</DropdownMenuItem>
                    <DropdownMenuItem>MemoryKeeper</DropdownMenuItem>
                    <DropdownMenuItem>TaskMaster</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
