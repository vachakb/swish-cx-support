# Swish Support Copilot

Automated customer-support engine for **Swish** (10-minute food delivery). It resolves FAQs and order issues end-to-end, escalates gracefully to a human when it should, and is built to plug into Swish's stack. **The engine is the product; the web app is a demo surface.**

> Runs with **no API key** out of the box (deterministic mock LLM). Add a Gemini key to switch on the real models. Fully typed; 35 passing tests.

## Highlights

- **ETA Truth** — never parrots a frozen "arriving in 3 min". It reasons over the ETA's *freshness* (last GPS ping, last recompute, promise breach) and either recomputes from the rider's distance or honestly says it's checking.
- **LLM proposes, deterministic core disposes** — the model never moves money. It emits a structured proposal; a `json-rules-engine` policy + fraud core decides; an idempotent executor performs it (no double refunds).
- **Fraud-aware** — amount caps, claim velocity, account age, order corroboration, and cross-ticket image-reuse all gate auto-resolutions.
- **Grounded answers** — FAQs/referrals are answered from real data (live wallet, serviceability, knowledge base), not canned strings.
- **Omnichannel + proactive** — one engine behind a web chat *and* a real-contract WhatsApp adapter, a shared inbox, and presence-aware notifications: a human's reply — or a proactive late-order heads-up — reaches the customer even after they leave the chat.

## Quickstart

```bash
npm install
npm run setup      # migrate + seed the local SQLite demo data
npm run dev        # API on :8787, web on :5173
# open http://localhost:5173
```

No API key needed — it runs on a deterministic mock LLM. To use real Gemini:

```bash
cp .env.example .env     # then set GEMINI_API_KEY=...  (free key from aistudio.google.com)
```

Single-port production build (the API serves the built UI):

```bash
npm run build && npm start   # http://localhost:8787
```

**Requirements:** Node ≥ 22 (developed on 26) and npm. No external services — the database is a local SQLite file.

## Try it

You're signed in as the seeded demo customer with a few orders. Open **Chat with support** (or "Need help" on an order):

- **Stuck order** → ask *"where's my order?"* → it refuses the frozen ETA and answers honestly instead of repeating "3 min".
- **A delivered order** → say an item spilled and attach any photo → vision corroborates the claim → instant Swish credit (within policy).
- *"Where's my referral reward?"* → reads the live wallet — an FAQ that's secretly a data lookup.
- **Shared Inbox** tab → open the escalated dispute and reply as a human → the customer gets a notification back in their chat.

## LLM provider / API keys

The LLM sits behind a small `LlmProvider` interface (`src/llm/`) with two implementations: **Gemini** (`@google/genai`) and a **deterministic mock**. The provider is chosen in config from `LLM_PROVIDER` (`gemini` | `mock`) and `GEMINI_API_KEY`.

- **Out of the box, only a Google Gemini key works** (or the key-free mock). A key from another vendor (OpenAI, Anthropic, …) is **not** picked up — the config only reads `GEMINI_API_KEY`, and the Gemini client talks to Google's API with Gemini-specific calls (structured output, thinking budget, inline images, usage metadata).
- **To use another provider**, implement `LlmProvider` for it (one file) and register it in `src/llm/index.ts`. The pipeline, policy, and handlers are provider-agnostic, so nothing else changes.
- Model ids default to Gemini 3.x and are overridable via `GEMINI_MODEL_FAST` / `GEMINI_MODEL_SMART` / `GEMINI_MODEL_VISION` if your key lacks access to a specific model.

## Architecture

```
channel adapter → intake → input guardrails → hybrid router (+sentiment/language)
  → vertical handler (FAQ · WISMO/ETA-Truth · order-action)
  → deterministic policy + fraud core → idempotent executor
  → response composer → output guardrails → escalation gate
```

Cross-cutting: tracing · eval/bake-off · notifications (SSE push) · proactive outreach.

Full design, decisions, and the architecture diagram: [`docs/DESIGN.md`](docs/DESIGN.md). Repo conventions: [`CLAUDE.md`](CLAUDE.md).

## Tech stack

TypeScript 6 / Node (ESM) · **Hono** (API) · **Drizzle + libSQL/SQLite** (data) · **Gemini** via `@google/genai`, pluggable, with a deterministic mock · **json-rules-engine** (policy) · **React 19 + Vite 8 + Tailwind v4** (UI) · **vitest** (35 tests).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API + web, hot reload |
| `npm run setup` | migrate + seed demo data |
| `npm run build` / `npm start` | build UI / serve UI + API on one port |
| `npm test` | run the test suite (35 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run bakeoff` | routing-strategy comparison (accuracy + latency) |
| `npm run db:generate` | regenerate Drizzle migrations after a schema change |
