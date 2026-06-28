# Swish Support Copilot

Automated customer-support engine for **Swish** (10-minute food delivery). It resolves FAQ and order-specific issues end-to-end, escalates gracefully to a human when it should, and is built to plug into Swish's own stack. The engine is the product; the web UI is a demo surface.

> Runs with **zero API keys** (deterministic mock LLM). Add a Gemini key to light up the real models. 28 tests, fully typed.

## Why it's different
- **ETA Truth** — it reasons over the ETA's *freshness* (last GPS ping, last recompute, promise breach), so on a stuck order it **apologises, auto-credits goodwill, and escalates** instead of parroting "arriving in 3 min" for 20 minutes. ([why this matters](docs/research.md#part-e--root-cause-why-live-etas-freeze--why-the-agent-parrots-them-))
- **LLM proposes, deterministic core disposes** — the model never executes a money action. It emits a structured proposal; a deterministic policy + fraud engine decides, and an idempotent executor performs it (no double refunds).
- **Fraud-aware refunds** — amount caps, claim velocity, account age, order corroboration, and cross-ticket image-reuse detection gate every auto-resolution.
- **Omnichannel** — one engine behind a web chat *and* a real-contract WhatsApp adapter, with a **shared inbox** and **presence-aware notifications** (a human's reply reaches the customer even after they leave the chat).
- **Plug-and-play** — provider interfaces matching Swish's conventions (Go/Fiber, Mongo, JWT); policy expressed as swappable JSON rules. ([contract](docs/research.md#part-f--swishs-tech-stack-confirmed--the-plug-and-play-contract))

## Quickstart
```bash
npm install
npm run setup      # create + seed the local SQLite demo data
npm run dev        # API on :8787, web on :5173
# open http://localhost:5173
```
Optional — use real Gemini instead of the mock:
```bash
cp .env.example .env   # then set GEMINI_API_KEY=...
```
Production-style single server (API + built UI on one port):
```bash
npm run build && npm start   # http://localhost:8787
```

## Try this in the Play Arena
Pick a scenario on the left, then chat — the **live trace panel** on the right shows every routing/ETA/policy decision.
- **"Late order, tracking stuck at 3 min"** → ask *"where is my order?"* → watch it refuse the stale ETA, apologise, credit ₹30, and escalate. (Contrast with **"Normal where is my order?"** → an honest live ETA.)
- **"Spillage with photo"** → attach any image → the photo corroborates the claim → instant Swish credit.
- **"Wrong order (repeat claimant)"** → the fraud-velocity rule trips → escalation instead of an auto-refund.
- **"Where's my referral reward?"** → a FAQ that's secretly a data query — it reads the live wallet.
- **Human handoff + notification** → trigger an escalation, switch to **Shared Inbox**, reply as a human → the customer gets a browser notification back in the Arena.
- **Make your own** → *+ new* profile, add a **Stuck / Healthy / Delivered** order, and chat as them.

## Architecture
`channel adapter → intake → input guardrails → hybrid router (+sentiment/language) → context + image validation → vertical handler (FAQ · order-info/ETA-Truth · order-action) → deterministic policy + fraud engine → idempotent executor → response composer → output guardrails → escalation / offline fallback`, with per-turn tracing and a routing bake-off.

Full design: [`docs/architecture.md`](docs/architecture.md) · [`docs/approaches-and-decisions.md`](docs/approaches-and-decisions.md) · [`docs/research.md`](docs/research.md).

## Tech stack
TypeScript + Node (ESM), **Hono** (API), **Drizzle + libSQL/SQLite** (data), **Gemini** via `@google/genai` (pluggable, with a deterministic mock), **json-rules-engine** (policy), **React 19 + Vite 8 + Tailwind v4** (UI), **vitest** (tests).

## Commands
| | |
|---|---|
| `npm run dev` | API + web, hot reload |
| `npm run setup` | migrate + seed demo data |
| `npm run build` / `npm start` | build UI / serve UI + API on one port |
| `npm test` | run the test suite (28 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run bakeoff` | routing strategy comparison (accuracy + latency) |

Conventions for contributors (and AI agents) live in [`CLAUDE.md`](CLAUDE.md).
