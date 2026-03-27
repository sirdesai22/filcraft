/**
 * runner.ts — Main agent loop.
 *
 * Each iteration:
 *  1. Check if the agent is still economically viable (has tFIL balance)
 *  2. Run the strategy to produce an artifact
 *  3. Store the artifact to FOC via Synapse SDK (or dry-run)
 *  4. Register the artifact on DataListingRegistry
 *  5. Record the storage cost to AgentEconomyRegistry
 *  6. Sleep until the next cycle
 */

import * as economy from "./economy.js";
import * as marketplace from "./marketplace.js";
import { storeArtifact } from "./foc.js";
import type { ArtifactOutput } from "./strategies/market-analyst.js";

export interface RunnerConfig {
  agentId: number;
  strategy: "market-analyst" | "news-curator" | "chain-monitor";
  intervalMs: number;  // milliseconds between cycles
  dryRun: boolean;
  maxCycles?: number;  // undefined = run forever
}

type StrategyModule = { run: () => Promise<ArtifactOutput> };

async function loadStrategy(name: RunnerConfig["strategy"]): Promise<StrategyModule> {
  switch (name) {
    case "market-analyst":
      return import("./strategies/market-analyst.js");
    case "news-curator":
      return import("./strategies/news-curator.js");
    case "chain-monitor":
      return import("./strategies/chain-monitor.js");
    default: {
      const _: never = name;
      void _;
      throw new Error(`Unknown strategy: ${name}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatWei(wei: bigint): string {
  return `${(Number(wei) / 1e18).toFixed(6)} tFIL`;
}

export async function runAgent(config: RunnerConfig): Promise<void> {
  const { agentId, strategy: strategyName, intervalMs, dryRun, maxCycles } = config;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Agent Economy Runner`);
  console.log(`Agent ID:  ${agentId}`);
  console.log(`Strategy:  ${strategyName}`);
  console.log(`Interval:  ${intervalMs / 1000}s`);
  console.log(`Dry-run:   ${dryRun}`);
  console.log(`Max cycles: ${maxCycles ?? "∞"}`);
  console.log(`${"=".repeat(60)}\n`);

  const strategyModule = await loadStrategy(strategyName);
  let cycle = 0;

  while (true) {
    if (maxCycles !== undefined && cycle >= maxCycles) {
      console.log(`[runner] reached max cycles (${maxCycles}), exiting.`);
      break;
    }

    cycle++;
    const cycleStart = Date.now();
    console.log(`\n[runner] ── Cycle ${cycle} ── ${new Date().toISOString()}`);

    // 1. Viability check (skip in dry-run — no contract to query)
    if (!dryRun) {
      try {
        const viable = await economy.isViable(agentId);
        if (!viable) {
          console.log(`[runner] Agent ${agentId} is not viable (balance depleted). Stopping.`);
          break;
        }
        const acct = await economy.getAccount(agentId);
        console.log(`[runner] Balance: ${formatWei(acct.balance)} | Spent: ${formatWei(acct.totalSpent)}`);
      } catch (err) {
        console.error("[runner] Economy check failed:", err);
        // Don't stop — continue with the cycle; economy contract may not be deployed yet
      }
    } else {
      console.log(`[runner] dry-run — skipping viability check`);
    }

    // 2. Run strategy
    let artifact: ArtifactOutput;
    try {
      console.log(`[runner] Running strategy: ${strategyName}`);
      artifact = await strategyModule.run();
      const sizeKb = (Buffer.byteLength(artifact.content, "utf8") / 1024).toFixed(1);
      console.log(`[runner] Artifact generated: ${sizeKb}KB ${artifact.mimeType}`);
      console.log(`[runner] Title: ${artifact.listing.title}`);
    } catch (err) {
      console.error("[runner] Strategy failed:", err);
      await sleep(Math.min(intervalMs, 60_000)); // back off 1min on strategy failure
      continue;
    }

    // 3. Store to FOC
    let cid: string;
    let costWei: bigint;
    try {
      const result = await storeArtifact(artifact.content, artifact.mimeType, dryRun);
      cid = result.cid;
      costWei = result.costWei;
      console.log(`[runner] Stored to FOC: ${cid} (cost: ${formatWei(costWei)})`);
    } catch (err) {
      console.error("[runner] FOC storage failed:", err);
      await sleep(Math.min(intervalMs, 60_000));
      continue;
    }

    // 4. Register on DataListingRegistry
    // Build a simple metadata URI (in production this would point to a real IPFS JSON blob)
    const metadataUri = `ipfs://QmPLACEHOLDER/${cid.slice(-12)}/metadata.json`;
    try {
      const { listingId, txHash } = await marketplace.registerListing(
        {
          cid,
          agentId,
          priceUsdc: artifact.listing.priceUsdc,
          license: artifact.listing.license,
          category: artifact.listing.category,
          metadataUri,
        },
        dryRun
      );
      console.log(`[runner] Listed on marketplace: listingId=${listingId} tx=${txHash ?? "dry-run"}`);
    } catch (err) {
      console.error("[runner] Marketplace registration failed:", err);
      // Continue — still record the storage cost
    }

    // 5. Record storage cost on AgentEconomyRegistry
    try {
      const txHash = await economy.recordStorageCost(agentId, costWei, cid, dryRun);
      console.log(`[runner] Storage cost recorded on-chain: ${txHash ?? "dry-run"}`);
    } catch (err) {
      console.error("[runner] Cost recording failed:", err);
    }

    // 6. Sleep until next cycle
    const elapsed = Date.now() - cycleStart;
    const remaining = Math.max(0, intervalMs - elapsed);
    console.log(`[runner] Cycle ${cycle} done in ${(elapsed / 1000).toFixed(1)}s. Next in ${(remaining / 1000).toFixed(0)}s.`);
    if (remaining > 0 && (maxCycles === undefined || cycle < maxCycles)) {
      await sleep(remaining);
    }
  }

  console.log(`\n[runner] Agent ${agentId} runner finished.`);
}
