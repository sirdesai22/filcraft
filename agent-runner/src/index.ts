/**
 * index.ts — CLI entrypoint for the RFS-4 agent economy runner.
 *
 * Usage:
 *   # Dry-run (no real FOC storage, no on-chain writes)
 *   pnpm tsx src/index.ts --strategy market-analyst --agent-id 1 --dry-run
 *
 *   # Live run (requires AGENT_PRIVATE_KEY, FOC_SERVICE_URL, deployed contracts)
 *   pnpm tsx src/index.ts --strategy chain-monitor --agent-id 42 --interval 7200
 *
 *   # Run exactly N cycles then exit
 *   pnpm tsx src/index.ts --strategy news-curator --agent-id 7 --cycles 1 --dry-run
 */

import { createRequire } from "module";
import { runAgent } from "./runner.js";

// Load .env
const _require = createRequire(import.meta.url);
try {
  const { config } = _require("dotenv");
  config();
} catch {
  // dotenv optional
}

type Strategy = "market-analyst" | "news-curator" | "chain-monitor";
const STRATEGIES: Strategy[] = ["market-analyst", "news-curator", "chain-monitor"];

// Default intervals in milliseconds
const DEFAULT_INTERVALS_MS: Record<Strategy, number> = {
  "market-analyst": 6 * 60 * 60 * 1000,  // 6h
  "news-curator":   24 * 60 * 60 * 1000, // 24h
  "chain-monitor":  2 * 60 * 60 * 1000,  // 2h
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.findIndex((a) => a === flag || a === flag.replace("--", "-"));
    return i !== -1 ? args[i + 1] : undefined;
  };
  const has = (flag: string): boolean =>
    args.includes(flag) || args.includes(flag.replace("--", "-"));

  const strategy = (get("--strategy") ?? "market-analyst") as Strategy;
  if (!STRATEGIES.includes(strategy)) {
    console.error(`Unknown strategy "${strategy}". Must be one of: ${STRATEGIES.join(", ")}`);
    process.exit(1);
  }

  const agentId = parseInt(get("--agent-id") ?? get("--agentId") ?? "1", 10);
  if (isNaN(agentId) || agentId < 0) {
    console.error("--agent-id must be a non-negative integer");
    process.exit(1);
  }

  const dryRun = has("--dry-run") || has("--dryRun");

  const intervalRaw = get("--interval");
  const intervalMs = intervalRaw
    ? parseInt(intervalRaw, 10) * 1000
    : DEFAULT_INTERVALS_MS[strategy];

  const cyclesRaw = get("--cycles");
  const maxCycles = cyclesRaw ? parseInt(cyclesRaw, 10) : undefined;

  return { strategy, agentId, dryRun, intervalMs, maxCycles };
}

async function main() {
  const config = parseArgs();

  console.log("RFS-4 Agent Economy Runner");
  console.log(`Strategy:   ${config.strategy}`);
  console.log(`Agent ID:   ${config.agentId}`);
  console.log(`Dry-run:    ${config.dryRun}`);
  console.log(`Interval:   ${config.intervalMs / 1000}s`);
  if (config.maxCycles !== undefined) {
    console.log(`Max cycles: ${config.maxCycles}`);
  }
  console.log();

  await runAgent(config);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
