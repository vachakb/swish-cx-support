# Swish Support Copilot

Automated customer-support engine for **Swish** (10-minute food delivery). It resolves FAQs and order issues end-to-end, escalates gracefully to a human when it should, and is built to plug into Swish's stack. **The engine is the product; the web app is a demo surface.**

> Add a free **Gemini API key** for real responses — without one it falls back to a deterministic mock (boots fine, but canned and rule-only). Fully typed; 47 passing tests.

📄 **The full write-up of the entire process** — research, design decisions and trade-offs, results, and what I deliberately didn't build — is in **[`docs/DESIGN.md`](docs/DESIGN.md)**.

## Highlights

- **ETA Truth** — never parrots a frozen "arriving in 3 min". It reasons over the ETA's *freshness* (last GPS ping, last recompute, promise breach) and either recomputes from the rider's distance or honestly says it's checking.
- **LLM proposes, deterministic core disposes** — the model never moves money. It emits a structured proposal; a `json-rules-engine` policy + fraud core decides; an idempotent executor performs it (no double refunds).
- **Fraud-aware** — amount caps, claim velocity, account age, order corroboration, and cross-ticket image-reuse all gate auto-resolutions.
- **Grounded answers** — FAQs/referrals are answered from real data (live wallet, serviceability, knowledge base), not canned strings.
- **Omnichannel + proactive** — one engine behind a web chat *and* a real-contract WhatsApp adapter, a shared inbox, and presence-aware notifications: a human's reply — or a proactive late-order heads-up — reaches the customer even after they leave the chat.

## Quickstart

```bash
npm install
cp .env.example .env          # then add your GEMINI_API_KEY (see below) — the only value you need to set
npm run setup                 # migrate + seed the local SQLite demo
npm run build && npm start    # serves the UI + API on one port
# open http://localhost:8787
```

**Requirements:** Node ≥ 22 and npm. No external services, no Docker — the database is a local SQLite file. Works on macOS, Linux, and Windows (PowerShell). Everything except the Gemini key has a working default (port, CORS, the API URL, model ids), so there's nothing else to configure.

### Gemini API key — needed for real responses

The engine needs a Gemini key to behave as intended. **Without one it falls back to a deterministic *mock*** — the app boots and the UI works, but replies are canned and routing is rule-only, so it won't act like the real product. Get a free key at [aistudio.google.com](https://aistudio.google.com/apikey) and put it in **`.env`** (not `.env.example`):

```
GEMINI_API_KEY=AIza...
```

The startup log shows which mode you're in: `[llm: gemini]` (key loaded) or `[llm: mock — no GEMINI_API_KEY found in .env]`.

### Developing

`npm run dev` runs Vite (hot-reload, :5173) + the API (:8787) together for live editing. To just run or evaluate the app, use `npm run build && npm start` above — one process, one port, nothing to configure.

## Try it

You're signed in as the seeded demo customer with a few orders. Open **Chat with support** (or "Need help" on an order):

- **Stuck order** → ask *"where's my order?"* → it refuses the frozen ETA and answers honestly instead of repeating "3 min".
- **A delivered order** → say an item spilled and attach any photo → vision corroborates the claim → instant Swish credit (within policy).
- *"Where's my referral reward?"* → reads the live wallet — an FAQ that's secretly a data lookup.
- **Shared Inbox** tab → open the escalated dispute and reply as a human → the customer gets a notification back in their chat.

## Architecture

```
channel adapter → intake → input guardrails → hybrid router (+sentiment/language)
  → vertical handler (FAQ · WISMO/ETA-Truth · order-action)
  → deterministic policy + fraud core → idempotent executor
  → response composer → output guardrails → escalation gate
```

Cross-cutting: tracing · eval/bake-off · notifications (SSE push) · proactive outreach.

The rendered architecture diagram and the rationale behind each stage are in [`docs/DESIGN.md`](docs/DESIGN.md). Repo conventions: [`CLAUDE.md`](CLAUDE.md).

## Tech stack

TypeScript 6 / Node (ESM) · **Hono** (API) · **Drizzle + libSQL/SQLite** (data) · **Gemini** via `@google/genai`, pluggable, with a deterministic mock · **json-rules-engine** (policy) · **React 19 + Vite 8 + Tailwind v4** (UI) · **vitest** (47 tests).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API + web, hot reload |
| `npm run setup` | migrate + seed demo data |
| `npm run build` / `npm start` | build UI / serve UI + API on one port |
| `npm test` | run the test suite (47 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run bakeoff` | routing-strategy comparison (accuracy + latency) |
| `npm run db:generate` | regenerate Drizzle migrations after a schema change |
