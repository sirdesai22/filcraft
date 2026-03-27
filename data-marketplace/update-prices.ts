import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { filecoinCalibration } from "viem/chains";
import * as dotenv from "dotenv";
dotenv.config();

const ABI = parseAbi([
  "function updatePrice(uint256 id, uint256 newPrice)",
]);

async function waitForReceipt(client: ReturnType<typeof createPublicClient>, hash: Hex, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { return await client.waitForTransactionReceipt({ hash, timeout: 30_000 }); }
    catch (e: unknown) { const m = e instanceof Error ? e.message : String(e); if (m.toLowerCase().includes("null round") || m.toLowerCase().includes("timed out")) { await new Promise(r => setTimeout(r, 4000)); continue; } throw e; }
  }
  throw new Error("timeout");
}

async function main() {
  const account = privateKeyToAccount(process.env.PRODUCER_PRIVATE_KEY as Hex);
  const registry = process.env.DATA_LISTING_REGISTRY_ADDRESS as `0x${string}`;
  const client = createPublicClient({ chain: filecoinCalibration, transport: http("https://api.calibration.node.glif.io/rpc/v1") });
  const wallet = createWalletClient({ account, chain: filecoinCalibration, transport: http("https://api.calibration.node.glif.io/rpc/v1") });

  // id → new price in USDC (6 decimals): 1c, 5c, 10c
  const updates: [bigint, bigint][] = [[1n, 10_000n], [2n, 50_000n], [3n, 100_000n]];

  for (const [id, price] of updates) {
    console.log(`Updating listing #${id} → $${Number(price)/1e6}...`);
    const h = await wallet.writeContract({ address: registry, abi: ABI, functionName: "updatePrice", args: [id, price] });
    await waitForReceipt(client, h);
    console.log(`  ✅ tx: ${h}`);
  }
  console.log("Done.");
}
main().catch(e => { console.error(e); process.exit(1); });
