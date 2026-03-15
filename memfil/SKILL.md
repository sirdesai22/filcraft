---
name: filcraft
description: Use this skill to export the current session memory as a structured markdown file and permanently store it on Filecoin via the FilCraft CLI. Trigger when the user says "export memory", "save session to Filecoin", "publish to marketplace", "persist this conversation", or similar.
---

# FilCraft — Export Session Memory to Filecoin

## What This Skill Does

When triggered, you (the AI agent) must:

1. **Export** the current session's key context — decisions, artifacts, code, discoveries, and outcomes — into a structured markdown file called an **episode**.
2. **Upload** that file to Filecoin permanent storage using the FilCraft CLI, which returns a PieceCID.
3. **Report** the CID back to the user so the memory is verifiable and retrievable forever.

## Step 1 — Write the Episode File

Create a markdown file in the `memfil/` directory. Use this structure:

```markdown
# <Short title summarizing the session>

## Context
<What the user asked for. The starting goal.>

## Decisions
<Key choices made during the session and why.>

## Artifacts
<Code snippets, configs, commands, or files produced. Use fenced code blocks.>

## Outcome
<What was achieved. Final state.>

## Metadata
- **Date**: <YYYY-MM-DD>
- **Tags**: <comma-separated: e.g. coding, reasoning, planning>
- **Agent**: <your name or "openclaw">
```

Write the file to `memfil/` with a descriptive filename:

```bash
# Example path — use a slug that describes the session
memfil/debug-auth-flow.md
memfil/refactor-database-layer.md
```

Rules for writing the episode:
- Be concise but complete. Another agent should be able to reconstruct the session from this file alone.
- Include actual code/commands in fenced blocks, not summaries of them.
- Tags should use the episode taxonomy: `reasoning`, `memory`, `coding`, `vision`, `planning`, `tool-use`.
- Do NOT include secrets, API keys, or credentials.

## Step 2 — Upload to Filecoin

Run the upload command from the `memfil/` directory. The CLI requires `.env` to be configured with `WALLET_PRIVATE_KEY` (see `env.example`).

```bash
cd memfil && pnpm upload -- ./<episode-filename>.md -o ./cid.json
```

This will:
- Upload the file to Filecoin (Calibration testnet) via the Synapse SDK.
- Print the **PieceCID** on success.
- Save the CID and metadata to `cid.json` (via the `-o` flag).

If the upload fails, check:
- `.env` has a valid `WALLET_PRIVATE_KEY`.
- The wallet is funded with tFIL (gas) and USDFC (storage).
- USDFC is deposited into the Synapse payments contract.

## Step 3 — Report Back to the User

After a successful upload, tell the user:

1. The **PieceCID** (the permanent Filecoin address of their memory).
2. The **download command** to retrieve it later:

```bash
cd memfil && pnpm download -- <pieceCid> --out ./downloads/<filename>.md
```

3. That the episode is permanently stored and CID-verifiable on Filecoin.

## Full Example

Suppose the user says: *"Export this session to Filecoin."*

1. Write the episode:

```bash
# You create memfil/setup-episodemarket.md with the session content
```

2. Upload it:

```bash
cd memfil && pnpm upload -- ./setup-episodemarket.md -o ./cid.json
```

3. Output to user:

> Session exported to Filecoin.
>
> **PieceCID**: `bafkzcibd24cqmbnc5qhh5gttjomk5xrte4d3mfiznhkbgkcvz4bs46h6arc4r7aw`
>
> Retrieve it anytime:
> ```
> cd memfil && pnpm download -- bafkzcibd24c... --out ./downloads/setup-episodemarket.md
> ```

## Prerequisites

The FilCraft CLI must be set up before this skill works:

1. `cd memfil && npm install` (or `pnpm install`).
2. Copy `env.example` to `.env` and set `WALLET_PRIVATE_KEY`.
3. Fund the wallet with **tFIL** (gas) from https://faucet.calibnet.chainsafe-fil.io.
4. Fund with **USDFC** (storage) from the calibration faucet.
5. Deposit USDFC to the Synapse payments contract via https://fs-upload-dapp.netlify.app.

## Quick Reference

| Step | What to do | Command |
|------|-----------|---------|
| Write episode | Create a structured `.md` file in `memfil/` | (use your file-writing tools) |
| Upload | Send the file to Filecoin | `cd memfil && pnpm upload -- ./<file>.md -o ./cid.json` |
| Download (verify) | Retrieve by CID | `cd memfil && pnpm download -- <pieceCid> --out ./downloads/<file>.md` |
