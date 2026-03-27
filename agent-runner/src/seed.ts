/**
 * seed.ts — CLI to top up agent budgets on AgentEconomyRegistry.
 *
 * Usage:
 *   tsx src/seed.ts --agent-id 42 --amount 0.1           # top up 0.1 tFIL
 *   tsx src/seed.ts --agent-id 42 --amount 0.1 --dry-run # log without tx
 *   tsx src/seed.ts --agent-id 42 --check                # print balance only
 */

import "dotenv/config";
import { parseEther, formatEther } from "viem";
import { getAccount, topUp } from "./economy";

function parseArgs(): {
  agentId: number;
  amount: number | null;
  dryRun: boolean;
  checkOnly: boolean;
} {
  const args = process.argv.slice(2);
  let agentId: number | null = null;
  let amount: number | null = null;
  let dryRun = false;
  let checkOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent-id" && args[i + 1]) {
      agentId = parseInt(args[++i], 10);
    } else if (args[i] === "--amount" && args[i + 1]) {
      amount = parseFloat(args[++i]);
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--check") {
      checkOnly = true;
    }
  }

  if (agentId === null || isNaN(agentId)) {
    console.error("Usage: tsx src/seed.ts --agent-id <N> [--amount <tFIL>] [--dry-run] [--check]");
    process.exit(1);
  }

  if (!checkOnly && (amount === null || isNaN(amount) || amount <= 0)) {
    console.error("Error: --amount <tFIL> is required unless --check is used");
    process.exit(1);
  }

  return { agentId, amount, dryRun, checkOnly };
}

async function printBalance(agentId: number) {
  try {
    const acct = await getAccount(agentId);
    console.log(`Agent #${agentId} balance: ${formatEther(acct.balance)} tFIL`);
    console.log(`  totalSpent:  ${formatEther(acct.totalSpent)} tFIL`);
    console.log(`  totalEarned: ${acct.totalEarned.toString()} USD-cents`);
    console.log(`  windDown:    ${acct.windDown}`);
  } catch (e) {
    console.log(`Agent #${agentId} not found in registry (balance: 0 tFIL)`);
  }
}

async function main() {
  const { agentId, amount, dryRun, checkOnly } = parseArgs();

  if (checkOnly) {
    await printBalance(agentId);
    return;
  }

  const amountWei = parseEther(amount!.toString());
  console.log(`Topping up agent #${agentId} with ${amount} tFIL (${amountWei} wei)${dryRun ? " [DRY RUN]" : ""}...`);

  const hash = await topUp(agentId, amountWei, dryRun);

  if (hash) {
    console.log(`✓ Transaction hash: ${hash}`);
  }

  await printBalance(agentId);
}

main().catch((e) => {
  console.error("seed failed:", e);
  process.exit(1);
});
