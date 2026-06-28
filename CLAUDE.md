# CLAUDE.md — Swish Support Copilot

Conventions for this repo. Read before writing code. **Frontend-specific rules live in [`web/CLAUDE.md`](web/CLAUDE.md).** Design rationale: [`docs/research.md`](docs/research.md), [`docs/approaches-and-decisions.md`](docs/approaches-and-decisions.md).

## What this is
Automated customer-support engine for **Swish** (10-min food delivery): resolves FAQ + order issues, escalates gracefully, plugs into Swish's stack. **The engine is the product; the web UI is a demo surface.**

## Ground rules (non-negotiable)
- **Verify, don't assume.** Every API contract, model id, library method, and endpoint is checked against *current* official docs before use. No invented APIs, no guessed model ids, no hallucinated behavior. Flag uncertainty; cite sources for version-specific claims. (Live example: Gemini 2.5 deprecated 2026-06-17 → we target Gemini 3.x.)
- **Build like it will scale**, even as a prototype: clean interfaces, stateless core, idempotent money actions, typed boundaries, tests on critical logic. No correctness shortcuts.
- **LLM proposes, deterministic code disposes.** The model never executes a money action. It emits a structured proposal; the deterministic policy core validates eligibility + fraud; a typed, idempotent executor performs it.
- **Never answer volatile data from memory.** ETA / order-status / balance is always freshly fetched and reasoned over for staleness (ETA Truth). Never parrot a cached number.
- **Money is integer paise.** Never floats. Brand it at the type layer.
- **Every external call has a timeout + AbortSignal.** No unbounded LLM/network calls on the request path.

## Architecture (the pipeline)
`channel adapter → intake/session → input guardrails → hybrid router (+sentiment/lang) → context + image validation → vertical handler (FAQ | order-info/ETA-Truth | order-action) → deterministic policy core (json-rules-engine) → idempotent executor → response composer → output guardrails → escalation gate / offline fallback`. Cross-cutting: **tracing**, **eval/bake-off**, **notifications** (push agent replies when the user has left the screen).

Invariants: handlers are pure where possible (`input → Result`), return discriminated-union `Result`s, and **don't throw across boundaries** — only the executor edge throws. One responsibility per module.

## Repo layout
- `src/` backend (ESM, run via `tsx`)
  - `config.ts` — typed env, validated via Zod at boot (all `process.env` reads live here)
  - `db/` — Drizzle schema, single client, migrate, ids, seed
  - `repositories/` — data access (the **only** place that touches `db`)
  - `providers/` — business provider interfaces + mocks (Orders / Tracking / Wallet / ActionExecutor)
  - `llm/` — `LlmProvider` interface + Gemini impl + deterministic mock
  - `policy/` — rule-engine + JSON rulesets
  - `pipeline/` — the stages
  - `eta/` — ETA Truth module
  - `channels/` — adapters (web, whatsapp)
  - `notifications/` — notification service + transports
  - `server/` — Hono routes
- `web/` — frontend (see `web/CLAUDE.md`)
- `docs/` — research + decisions (living deliverable)
- `drizzle/` — generated migrations (committed)

## TypeScript 6 / Node 26
- ESM only. `node:` prefix on builtins. Prefer globals: `fetch`, `structuredClone`, `crypto.randomUUID()`.
- `import type` for type-only imports (`verbatimModuleSyntax` + `erasableSyntaxOnly` are on). **No `enum`/value-`namespace`** — use `as const` unions. **No `any`; no value-changing `as`** (allowed: `as const`, branded constructors, `satisfies`).
- `Result` unions for fallible ops: `type Result<T,E> = { ok: true; value: T } | { ok: false; error: E }`.
- Branded types for ids + money: `type Paise = number & { readonly __brand: 'Paise' }`, `type OrderId = string & { readonly __brand: 'OrderId' }`.
- Exhaustive switches: `default: { const _x: never = kind; throw new Error(\`unhandled \${_x}\`); }`.
- `satisfies` for lookup tables/config. `noUncheckedIndexedAccess` is on — narrow before indexing.

## Hono 4
- Typed context: `new Hono<{ Variables: {...} }>()`; never untyped `c.set`.
- Validate with `@hono/zod-validator`; read `c.req.valid('json')`. `z.coerce` for query/param strings.
- Errors: throw `HTTPException` for client errors; central `app.onError` maps domain errors → status, logs `traceId`, leaks nothing.
- Stream LLM replies via `streamSSE`; **errors mid-stream need the stream error callback** (`onError` can't catch them); honor `c.req.raw.signal` to abort upstream.
- Static via `@hono/node-server/serve-static`.

## Zod 4
- Define schemas **once at module scope** (reuse = the v4 perf win). Derive types with `z.infer`.
- Untrusted input (LLM output, webhooks, channel payloads, env) → **`safeParse`**, branch on `.success`. `parse` only for trusted invariants.
- `z.discriminatedUnion` for tagged shapes (router output, actions, messages) — pairs with the exhaustive switch.
- `import * as z from 'zod'`; top-level formats (`z.email()`); `.extend()` not `.merge()`.

## Drizzle (SQLite / libSQL)
- Single `db` client in `db/client.ts`; repositories are its only consumers.
- Money = integer paise; timestamps `integer({ mode: 'timestamp_ms' })`; bool `integer({ mode: 'boolean' })`.
- Row types via `$inferSelect` / `$inferInsert`. Prepared statements (`sql.placeholder`) for hot queries. RQB `db.query…{ with }` to avoid N+1. Transactions for multi-write invariants (**no LLM/network inside**). **Unique idempotency key** on `resolutions`.

## Gemini — `@google/genai` v2.x (verify ids at build time)
- Init `new GoogleGenAI({ apiKey })`; call `ai.models.generateContent({ model, contents, config })`. **All gen params live under `config`.**
- **Models — Gemini 3.x (2.5 is deprecated):** routing/sentiment → `gemini-3.1-flash-lite` (thinking off, cheap); reasoning/response → Gemini 3 Pro (verify current GA id); vision/balanced → `gemini-3.5-flash` (alias `gemini-flash-latest`). **Keep model ids in config, never as literals; re-verify against ai.google.dev before relying.**
- Structured output: `responseMimeType:'application/json'` + `responseSchema` (the `Type` enum). **Zod is the source of truth + runtime validator** — always `safeParse(JSON.parse(res.text))`; the SDK does NOT validate.
- Tools: `tools:[{ functionDeclarations }]`; read `res.functionCalls`; reply with a `functionResponse` part; `mode: ANY` to force a call (routing).
- Vision: `inlineData:{ mimeType, data: base64 }`; ≤20 MB inline (else File API).
- Latency: `thinkingConfig:{ thinkingBudget: 0 }` on the cheap path; tight `maxOutputTokens`; put stable boilerplate at the **front** of the prompt (implicit caching).
- Every call: `config.abortSignal` + `config.httpOptions.timeout` (ms); backoff on 429/503; never retry 400.
- All access behind the `LlmProvider` interface; deterministic mock for key-free runs. Two SDK surfaces exist (`ai.models` camelCase vs `ai.interactions` snake_case) — **we use `ai.models`; don't mix field names.**

## Testing (vitest 4)
- Unit-test the deterministic core exhaustively: policy/refund math (paise), ETA Truth gates, idempotency, discriminated-union parses. Keep them pure → no mocks needed.
- Mock only the provider boundary (`LlmProvider`, business providers). Fake timers + fixed system time for ETA/timestamp tests; stub id-gen for stable snapshots.
- `tsc --noEmit` is the type gate (vitest does not type-check).

## Conventions
- Clean, modular, DRY — reuse helpers, one responsibility per file, **short comments that explain *why*, not *what***. No overengineering, no speculative abstraction.
- Performance first: prepared statements, no sync IO on hot paths, tiered models, keep the cheap path cheap.
- **CX voice:** responses use Swish's warm, concrete brand voice — personalised, *not* a generic "AI assistant." Don't overdo it.
- **Commits:** author `vachakb`, **no Claude co-author trailer**, short imperative messages, commit regularly.

## Commands
- `npm run dev` — API + web together · `npm run setup` — migrate + seed
- `npm test` · `npm run typecheck` · `npm run db:generate` (after schema changes)
