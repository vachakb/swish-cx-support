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

The engine needs a Gemini key to behave as intended. **Without one it falls back to a deterministic *mock*** — the app boots and the UI works, but replies are canned and routing is rule-only, so it won't act like the real product. 

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

## Configuration (`.env`)

`cp .env.example .env`, then set **`GEMINI_API_KEY`** — that's the only value you need. Everything else has a working default, and the optional vars ship commented-out in `.env.example`, so they fall back to those defaults until you choose to override them.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | **for real responses** | — | Google AI Studio key. Blank → deterministic **mock** (boots, but canned + rule-only — not the real product). |
| `LLM_PROVIDER` | no | auto | Force `gemini` or `mock`; blank auto-selects (gemini if a key is present, else mock). |
| `PORT` | no | `8787` | API port — the dev proxy and `npm start` both target it. |
| `DATABASE_URL` | no | `file:./data/swish.db` | libSQL / SQLite connection string. |
| `GEMINI_MODEL_FAST` / `_SMART` / `_VISION` | no | `gemini-3.1-flash-lite` / `gemini-3.5-flash` / `gemini-3.5-flash` | Per-tier model ids (routing + sentiment / reasoning / vision). |
| `RATE_LIMIT_ENABLED` / `_WINDOW_MS` / `_GLOBAL` / `_CHAT` | no | on / `60000` / `200` / `30` | In-process per-IP rate limit (global ceiling + a tighter cap on `/api/chat`); set `RATE_LIMIT_ENABLED=false` to disable. |
| `VITE_API_URL` | no | relative (same-origin) | Frontend → API base URL. Set **only** if the web app is served on a different origin than the API. |
| `CORS_ORIGINS` | no | `localhost:5173,4173` | API CORS allowlist (or `*`). Only used when `VITE_API_URL` is cross-origin. |
| `WHATSAPP_VERIFY_TOKEN` / `ACCESS_TOKEN` / `PHONE_NUMBER_ID` / `GRAPH_BASE` | no | simulator | Set access token + phone-number id to send real WhatsApp messages; otherwise the WhatsApp tab is a simulator. |

Blank values are treated as unset (they fall back to the defaults above), and the startup log confirms your LLM mode: `[llm: gemini]` or `[llm: mock — no GEMINI_API_KEY found in .env]`. The annotated template is `.env.example`.

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
