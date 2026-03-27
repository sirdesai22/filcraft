/**
 * foc.ts — Synapse SDK / FOC (Filecoin Onchain Cloud) storage adapter.
 *
 * This module wraps the Synapse SDK behind a stable interface so that
 * swapping SDK versions requires changes only here.
 *
 * Status: The Synapse SDK (FOC M4.1) is targeted for release around March 14, 2026.
 * Until then, dry-run mode returns a mock CID without hitting the network.
 *
 * Once the SDK ships, replace the stub body of `storeWithSynapse` with the
 * real Synapse client call. The rest of the codebase uses only `storeArtifact`.
 */

export interface StoreResult {
  cid: string;
  costWei: bigint;
  /** True if this was a dry-run (no real storage occurred) */
  dryRun: boolean;
}

/**
 * Store data on Filecoin Onchain Cloud via the Synapse SDK.
 *
 * @param data     Raw content to store (UTF-8 string or Buffer)
 * @param mimeType MIME type (e.g. "application/json", "text/markdown")
 * @param dryRun   If true, skip real storage and return a deterministic mock CID
 */
export async function storeArtifact(
  data: string | Buffer,
  mimeType: string,
  dryRun = false
): Promise<StoreResult> {
  if (dryRun) {
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    // Deterministic mock CID based on content length + timestamp
    const mockCid = `bafyDRYRUN${buf.length}x${Date.now().toString(36)}`;
    const mockCostWei = BigInt(5_000_000_000_000_000); // 0.005 tFIL
    console.log(`[foc] dry-run — mock CID: ${mockCid}, cost: ${mockCostWei} wei`);
    return { cid: mockCid, costWei: mockCostWei, dryRun: true };
  }

  return storeWithSynapse(data, mimeType);
}

/**
 * Real Synapse SDK call — replace this stub once the SDK ships.
 *
 * Expected SDK interface (subject to change):
 *   import { Synapse } from "@filecoin-storage/synapse-sdk"
 *   const client = new Synapse({ privateKey: process.env.AGENT_PRIVATE_KEY! })
 *   const { cid } = await client.store({ data, mimeType })
 *   const cost = await client.getStorageCost(cid)
 */
async function storeWithSynapse(
  data: string | Buffer,
  mimeType: string
): Promise<StoreResult> {
  // ── TODO: replace stub with real Synapse SDK call after M4.1 release ──────
  //
  //   import { Synapse } from "@filecoin-storage/synapse-sdk";
  //   const client = new Synapse({ privateKey: process.env.AGENT_PRIVATE_KEY! });
  //   const { cid } = await client.store({ data, mimeType });
  //   const cost = await client.getStorageCost(cid);
  //   return { cid, costWei: BigInt(cost), dryRun: false };
  //
  // ─────────────────────────────────────────────────────────────────────────

  void mimeType; // used by real SDK
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  throw new Error(
    `FOC real storage not yet implemented. ` +
    `Synapse SDK (M4.1) not yet released. ` +
    `Data size: ${buf.length} bytes. ` +
    `Use --dry-run flag for local testing.`
  );
}
