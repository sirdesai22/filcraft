# ERC-8004 Agent Registry — Filecoin Calibration

This registry lets anyone publish an AI agent identity on-chain using the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) standard. Each agent is an ERC-721 NFT backed by a JSON metadata file (the "agent card") stored on IPFS.

## Contract Addresses

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| IdentityRegistry   | `0xa450345b850088f68b8982c57fe987124533e194` |
| ReputationRegistry | `0x11bd1d7165a3b482ff72cbbb96068d1298a9d07c` |

**Network:** Filecoin Calibration Testnet
**Chain ID:** `314159`
**RPC:** `https://api.calibration.node.glif.io/rpc/v1`
**Explorer:** https://calibration.filscan.io
**Faucet (tFIL):** https://faucet.calibnet.chainsafe-fil.io/funds.html

---

## Step 1 — Create your agent card

Create a JSON file describing your agent. Save it as `agent-card.json`:

```json
{
  "name": "My Agent",
  "description": "What your agent does in one or two sentences.",
  "image": "https://example.com/agent-logo.png",
  "active": true,
  "x402Support": false,
  "supportedTrusts": ["self"],
  "mcpEndpoint": "https://your-agent.example.com/mcp",
  "mcpTools": ["tool_name_1", "tool_name_2"],
  "a2aEndpoint": "",
  "a2aSkills": []
}
```

**Fields:**

| Field            | Type       | Description |
|------------------|------------|-------------|
| `name`           | `string`   | Human-readable agent name |
| `description`    | `string`   | Short description of what the agent does |
| `image`          | `string`   | URL or IPFS URI to a logo image |
| `active`         | `boolean`  | Whether the agent is currently accepting requests |
| `x402Support`    | `boolean`  | Whether the agent accepts x402 micropayments |
| `supportedTrusts`| `string[]` | Trust levels supported (`"self"`, `"vouched"`, etc.) |
| `mcpEndpoint`    | `string`   | MCP server URL (leave empty if not applicable) |
| `mcpTools`       | `string[]` | List of MCP tool names exposed |
| `a2aEndpoint`    | `string`   | A2A endpoint URL (leave empty if not applicable) |
| `a2aSkills`      | `string[]` | List of A2A skill IDs |

All fields are optional. An agent with neither `mcpEndpoint` nor `a2aEndpoint` is classified as `CUSTOM` protocol.

---

## Step 2 — Upload to IPFS

You need a permanent IPFS URI for your agent card. Any pinning service works (Pinata, web3.storage, nft.storage, etc.).

### Option A — Filecoin Pin CLI (recommended for Filecoin)

```bash
npm install -g @filecoin-shipyard/filecoin-pin
filecoin-pin upload agent-card.json
```

The output will include a CID, e.g. `bafybeiaorr...`. Your URI is:
```
ipfs://bafybeiaorr.../agent-card.json
```

### Option B — Pinata or any IPFS gateway

Upload `agent-card.json` via your preferred service and copy the `ipfs://...` URI.

---

## Step 3 — Register on-chain

You need a wallet with tFIL. Get some from the faucet listed above, then call `register(string agentURI)` on the IdentityRegistry.

### Using cast (Foundry)

```bash
cast send \
  0xa450345b850088f68b8982c57fe987124533e194 \
  "register(string)(uint256)" \
  "ipfs://YOUR_CID/agent-card.json" \
  --rpc-url https://api.calibration.node.glif.io/rpc/v1 \
  --private-key YOUR_PRIVATE_KEY
```

### Using viem (TypeScript)

```typescript
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { filecoinCalibration } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const IDENTITY_REGISTRY = "0xa450345b850088f68b8982c57fe987124533e194";

const abi = parseAbi([
  "function register(string agentURI) external returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");

const walletClient = createWalletClient({
  account,
  chain: filecoinCalibration,
  transport: http("https://api.calibration.node.glif.io/rpc/v1"),
});

const publicClient = createPublicClient({
  chain: filecoinCalibration,
  transport: http("https://api.calibration.node.glif.io/rpc/v1"),
});

const hash = await walletClient.writeContract({
  address: IDENTITY_REGISTRY,
  abi,
  functionName: "register",
  args: ["ipfs://YOUR_CID/agent-card.json"],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });

// Parse the Registered event to get your agentId
const logs = parseEventLogs({ abi, logs: receipt.logs });
const registered = logs.find((l) => l.eventName === "Registered");
console.log("Agent ID:", registered?.args.agentId.toString());
```

### Using ethers.js (v6)

```javascript
import { ethers } from "ethers";

const IDENTITY_REGISTRY = "0xa450345b850088f68b8982c57fe987124533e194";
const ABI = [
  "function register(string agentURI) external returns (uint256 agentId)",
];

const provider = new ethers.JsonRpcProvider("https://api.calibration.node.glif.io/rpc/v1");
const signer = new ethers.Wallet("0xYOUR_PRIVATE_KEY", provider);

const registry = new ethers.Contract(IDENTITY_REGISTRY, ABI, signer);
const tx = await registry.register("ipfs://YOUR_CID/agent-card.json");
const receipt = await tx.wait();

// agentId is returned as the first return value
console.log("Tx:", receipt.hash);
```

The `register` function returns your `agentId` (a `uint256` starting from 0). Note it in your records — you'll need it to update the agent later.

---

## Step 4 — Verify your registration

```bash
# Read the current URI for agentId 0
cast call \
  0xa450345b850088f68b8982c57fe987124533e194 \
  "tokenURI(uint256)(string)" \
  0 \
  --rpc-url https://api.calibration.node.glif.io/rpc/v1

# Read the owner
cast call \
  0xa450345b850088f68b8982c57fe987124533e194 \
  "ownerOf(uint256)(address)" \
  0 \
  --rpc-url https://api.calibration.node.glif.io/rpc/v1
```

Your agent will also appear on the registry explorer once the Goldsky subgraph indexes the transaction (usually within a few seconds).

---

## Updating your agent card

If you publish a new version of your agent card, update the on-chain URI:

```bash
cast send \
  0xa450345b850088f68b8982c57fe987124533e194 \
  "setAgentURI(uint256,string)" \
  YOUR_AGENT_ID \
  "ipfs://NEW_CID/agent-card.json" \
  --rpc-url https://api.calibration.node.glif.io/rpc/v1 \
  --private-key YOUR_PRIVATE_KEY
```

Only the current NFT owner (or an approved operator) can call `setAgentURI`.

---

## Setting a separate agent wallet

By default, the wallet that registers the agent is recorded as the `agentWallet`. If your agent runs with a separate hot wallet, you can link it (requires an EIP-712 signature from the new wallet):

```bash
# This requires signing a structured message from newWallet
cast send \
  0xa450345b850088f68b8982c57fe987124533e194 \
  "setAgentWallet(uint256,address,uint256,bytes)" \
  YOUR_AGENT_ID \
  NEW_WALLET_ADDRESS \
  DEADLINE_UNIX_TIMESTAMP \
  SIGNATURE_FROM_NEW_WALLET \
  --rpc-url https://api.calibration.node.glif.io/rpc/v1 \
  --private-key OWNER_PRIVATE_KEY
```

---

## Contract ABI (key functions)

```json
[
  "function register() external returns (uint256 agentId)",
  "function register(string agentURI) external returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newURI) external",
  "function tokenURI(uint256 agentId) external view returns (string)",
  "function ownerOf(uint256 agentId) external view returns (address)",
  "function getAgentWallet(uint256 agentId) external view returns (address)",
  "function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
  "event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)"
]
```

---

## Notes

- **This is a testnet.** Filecoin Calibration uses tFIL (test tokens) with no real value.
- Agent IDs are assigned sequentially starting from 0.
- The NFT can be transferred. When transferred, the `agentWallet` is automatically cleared for security.
- The registry is upgradeable (UUPS proxy) and owned by the deployer (`0x0A7c56744ed6fd786931E11E40F462CF213654b0`).
- There is no registration fee — you only pay Filecoin gas.
