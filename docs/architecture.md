# Architecture

How the engine is put together, why, and how it scales. Decision rationale lives in [`approaches-and-decisions.md`](approaches-and-decisions.md); research in [`research.md`](research.md).

## The pipeline

```
 CHANNELS (adapters)   web chat  ·  WhatsApp (real Cloud API contract)     one engine, both
        │ canonical TurnInput
 [1] intake + session            load/create conversation, append message
 [2] INPUT guardrails            empty · gibberish · prompt-injection strip
 [3] HYBRID ROUTER (+signals)    rules(refund/cancel/WISMO/…) + small LLM for the tail
                                 → { intent, confidence, sentiment, language }
 [4] context + IMAGE validation  load live order/wallet · sha256 cross-ticket dedupe
   ┌── vertical handlers ───────────────────────────────────────────────┐
   │ FAQ            retrieve + ground (referral/serviceability/policy)   │
   │ order-info     ETA TRUTH → honest + proactive (never parrots)       │
   │ order-action   claim → vision score → propose (refund/credit/cancel)│
   └────┬───────────────────────────────────────────────────────────────┘
 [5] POLICY + FRAUD engine (deterministic, json-rules-engine)
        amount cap · velocity · account age · corroboration · duplicate image → resolve | escalate | deny
 [6] action executor (typed · idempotent · re-validates live state) → provider adapters
 [7] response composer (Swish voice)   +   [8] OUTPUT guardrails (groundedness · no persona leak)
 [9] escalation gate → shared inbox / human   ·   offline fallback (never a dead end)
 ─────────────────────────────────────────────────────────────────────────────
 cross-cutting:  per-turn TRACING  ·  routing BAKE-OFF  ·  presence-aware NOTIFICATIONS
```

**Invariants:** handlers are pure where possible (`input → Result`); only the executor edge performs writes; the LLM never holds money authority; volatile data (ETA/status/balance) is always re-fetched and reasoned over for staleness.

## Components

| Layer | Module | Role |
|---|---|---|
| Channels | `src/channels`, `src/server` | Web chat + WhatsApp adapter (real webhook/verify/send contract); Hono routes |
| Router | `src/pipeline/router.ts` | Hybrid: deterministic rules for critical intents + a cheap LLM for the tail; emits intent/sentiment/language |
| Handlers | `src/pipeline/handlers` | One vertical per intent family (FAQ, order-info, order-action, …); least-privilege |
| ETA Truth | `src/eta` | Staleness/stuck/breach gates → confidence + recommendation (the signature feature) |
| Policy | `src/policy` | Deterministic fraud signals + `json-rules-engine` rulesets → `auto_approve / escalate / deny` |
| Providers | `src/providers` | `OrdersProvider`/`TrackingProvider`/`WalletProvider`/`ActionExecutor` interfaces + mock impls |
| LLM | `src/llm` | `LlmProvider` interface, Gemini impl, deterministic mock |
| Data | `src/db`, `src/repositories` | Drizzle schema, single client, typed repositories |
| Eval | `src/eval` | Labeled dataset + routing bake-off |
| UI | `web/` | React arena (chat + trace + profiles), shared inbox, notifications |

## Data model

13 tables (Drizzle/SQLite), shaped to Swish's Mongo conventions (camelCase, string ids, `isValid`, `createdAt`/`updatedAt`):
`customers`, `wallets`, `serviceability`, `orders`, `orderItems`, **`orderTracking`** (carries the ETA-staleness metadata: `etaLastComputedAt`, `riderLastGpsAt`, `stateLastTransitionAt`), `conversations` (the shared inbox), `messages`, `attachments` (sha256 + integrity + vision score), **`resolutions`** (the action ledger; unique `idempotencyKey` ⇒ no double refunds), `auditLog`, `scenarios` (arena), `traces`.

All money is **integer paise**. Refund/credit safety rests on the `resolutions.idempotencyKey` unique constraint + the executor re-validating live state in a transaction.

## Scaling to 100k+ users (what's in place vs. what we'd add)

**Already designed for it (demonstrated here):**
- **Stateless core** — no in-memory session affinity; conversation/session state lives in the DB behind a repository interface (swap SQLite → Postgres/Redis with no core changes).
- **Idempotent money actions** — unique idempotency keys + live re-validation make retries safe.
- **Swappable provider adapters** — every external dependency (orders, tracking, wallet, actions, LLM, WhatsApp) is an interface; mocks today, Swish's real services tomorrow.
- **Tiered models + cheap path** — rules resolve 60% of routing with zero model latency; the cheap model handles the tail.
- **Per-turn tracing** — every decision is observable for debugging and eval.

**What we'd add for true scale (named, not built — avoiding premature infra):**
- **Redis** for session/conversation cache + rate limiting; **Postgres** (read replicas) for the system of record.
- A **real queue** (SQS/Kafka) for the escalation + notification fan-out, replacing the in-process path; **Web Push/FCM/APNs** transports behind the existing `NotificationService` shape.
- **Autoscaled stateless workers** behind a load balancer; the LLM provider already autoscales on the vendor side.
- **Sampled LLM-as-judge** eval on production traffic (the bake-off harness generalises to this), plus a vector store *only if* the FAQ corpus outgrows the in-code KB.

This mirrors Zepto's own conclusion: start as a modular monolith, split only when scale demands it. (See `research.md`.)

## Plug-and-play into Swish

Provider interfaces return Mongo-shaped camelCase JSON over REST/JSON; auth is pluggable (JWT / `x-auth-key`); policy is `json-rules-engine` JSON (API-compatible with Swish's own `@swishhq/rule-engine`). To go live: point the adapter base URL at `prod-api.justswish.in`, drop in credentials, map a few domain fields. WhatsApp: set the Meta creds in `.env` and point the webhook at `/api/whatsapp/webhook`. Full contract: [`research.md` Part F](research.md#part-f--swishs-tech-stack-confirmed--the-plug-and-play-contract).
