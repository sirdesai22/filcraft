# filecoin-synapse-cli

A TypeScript CLI for uploading and downloading files on Filecoin using the [@filoz/synapse-sdk](https://github.com/FilOzone/synapse-sdk). Targets the **Calibration testnet** by default.

---

## Folder Structure

```
filecoin-synapse-cli/
├── src/
│   ├── index.ts                 # CLI entry point (Commander)
│   ├── commands/
│   │   ├── upload.ts            # `upload <file>` command
│   │   └── download.ts          # `download <pieceCid>` command
│   └── utils/
│       └── client.ts            # Synapse client factory + config loader
├── .env                         # Your secrets (never commit this)
├── .env.example                 # Template for env vars
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Prerequisites

Before uploading files you need:

1. **tFIL** (gas) — get free testnet FIL:
   - https://faucet.calibnet.chainsafe-fil.io
   - https://beryx.zondax.ch/faucet

2. **USDFC** (storage payments) — get testnet USDFC:
   - https://faucet.calibration.filecoin.io (check for USDFC option)

3. **Deposit USDFC** into the Synapse payments contract before uploading. The easiest way is via the web app: https://fs-upload-dapp.netlify.app

---

## Setup

```bash
# 1. Install dependencies
npm install        # or pnpm install / yarn

# 2. Configure environment
cp .env.example .env
# Edit .env and set WALLET_PRIVATE_KEY
```

**.env**
```env
WALLET_PRIVATE_KEY=0xyour_private_key_here
NETWORK=calibration
WITH_CDN=true
# GLIF_TOKEN=optional_for_higher_rate_limits
```

---

## Usage

### Upload a file

```bash
npm run dev -- upload ./path/to/file.jpg

# Save the resulting PieceCID to a JSON file
npm run dev -- upload ./data.csv --output ./cid.json
```

Output:
```
📤  Filecoin Upload
─────────────────────────────────────────────
  File   : file.jpg
  Size   : 142.50 KB

  Network : calibration
  RPC URL : wss://wss.calibration.node.glif.io/apigw/lotus/rpc/v1
  CDN     : enabled

✓ Provider selected: 0xabc...
✓ Using existing proof set: 42
✅ File uploaded successfully
   PieceCID: baga6ea4seaq...
```

### Download a file

```bash
npm run dev -- download baga6ea4seaq... --out ./downloads/file.jpg
```

Output:
```
📥  Filecoin Download
─────────────────────────────────────────────
  PieceCID : baga6ea4seaq...
  Save to  : /abs/path/downloads/file.jpg

✅ File saved successfully
   Path : /abs/path/downloads/file.jpg
   Size : 142.50 KB
```

### Help

```bash
npm run dev -- --help
npm run dev -- upload --help
npm run dev -- download --help
```

---

## Build & Run compiled

```bash
npm run build        # compiles TypeScript → dist/
node dist/index.js upload ./file.txt
node dist/index.js download baga6ea4seaq... --out ./out.txt
```

---

## Environment Variables

| Variable           | Required | Default         | Description                                |
|--------------------|----------|-----------------|--------------------------------------------|
| `WALLET_PRIVATE_KEY` | ✅ Yes  | —               | Your EVM wallet private key (with/without `0x`) |
| `NETWORK`          | No       | `calibration`   | `calibration` or `mainnet`                 |
| `WITH_CDN`         | No       | `true`          | Enable CDN for faster downloads            |
| `GLIF_TOKEN`       | No       | —               | GLIF API Bearer token for higher rate limits |

---

## Notes

- The SDK uses **USDFC** as the payment token for storage deals.
- Content integrity is **automatically verified** on download against the CID.
- Proof set creation (first upload with a new provider) takes a few minutes — progress is shown live.
- For mainnet, change `NETWORK=mainnet` in your `.env`.
