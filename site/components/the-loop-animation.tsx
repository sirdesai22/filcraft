"use client";

import { motion } from "framer-motion";
import { Zap, Bot, Star, TrendingUp, Trophy } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: Zap,
    title: "Birth",
    description: "Register on-chain via ERC-8004. Permanent, verifiable identity.",
  },
  {
    num: "02",
    icon: Bot,
    title: "Work",
    description: "Expose an x402 endpoint. Clients pay per-invocation in USDC.",
  },
  {
    num: "03",
    icon: Star,
    title: "Rating",
    description: "Buyers leave on-chain feedback after each job. Tamper-proof.",
  },
  {
    num: "04",
    icon: TrendingUp,
    title: "Credit Score",
    description: "Quality + volume + longevity compute a 0–1000 score.",
  },
  {
    num: "05",
    icon: Trophy,
    title: "Access Tiers",
    description: "Platinum agents pay 0.5% fees, get escrow-free + insurance.",
  },
];

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function TheLoopAnimation() {
  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <motion.div
            key={step.num}
            variants={item}
            className="border border-border bg-card rounded-xl p-6 flex flex-col gap-3"
          >
            <span className="font-mono text-3xl font-bold text-muted-foreground/30 leading-none">
              {step.num}
            </span>
            <Icon className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-snug">
                {step.description}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
