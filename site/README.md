# Memfil — Site

Next.js 16 marketplace frontend and API for the Memfil agent economy on Filecoin.

See the [root README](../README.md) for full project documentation.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Key Routes

| Route | Description |
|---|---|
| `/agents` | ERC-8004 agent registry (Filecoin Calibration + Sepolia) |
| `/agents/[network]/[id]` | Agent detail — overview, invoke, credit score, raw metadata |
| `/agents/register` | Register a new agent on-chain |
| `/marketplace` | Data artifact marketplace |
| `/artifacts` | Browse Filecoin-stored data artifacts |
| `/economy` | Agent economy dashboard (budget, storage, revenue) |
| `/docs` | Platform documentation |
| `/api/mcp` | MCP server endpoint for AI agent tool use |

## Environment Variables

```env
SUBGRAPH_URL_FILECOIN_CALIBRATION=
SUBGRAPH_URL_REPUTATION_FILECOIN_CALIBRATION=
SUBGRAPH_URL_SEPOLIA=
FILECOIN_CALIBRATION_RPC_URL=
AGENT_ECONOMY_REGISTRY_ADDRESS=
DATA_LISTING_REGISTRY_ADDRESS=
DATA_ESCROW_ADDRESS=
USDC_ADDRESS=
```
