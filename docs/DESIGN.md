# Swish Support Copilot — Design & Decisions

Everything that went into building an automated customer-support engine for Swish (10-minute food delivery) — the research, the reasoning, what I built, what I deliberately didn't, the numbers, and where it goes next.

Sorry it's a bit long, but it highlights the whole process :)

## 1. The problem

What people actually complain about:

| Complaint | Source |
|---|---|
| Routed through preset replies, **no way to reach a human** — users just abandon the ticket | [Storyboard18](https://www.storyboard18.com/brand-marketing/why-ai-led-customer-support-frustrates-swiggy-zomato-users-ws-l-92842.htm) |
| **Canned answers** that miss the nuance (a driver issue ≠ a kitchen mistake) | [Unstar](https://unstar.app/blog/food-delivery-app-reviews-what-customers-hate-most-2026) |
| Bots **deflect refunds** into "mazes of AI ambiguity" until you give up | [CNBC](https://www.cnbc.com/2026/04/01/ai-chatbot-customer-service-complaints-refunds.html) |

---

## 2. What the field taught us

I started from two real teardowns — **Swiggy's** support agent ([Databricks blog](https://www.databricks.com/blog/redefining-customer-support-swiggys-enterprise-scale-ai-agent-built-databricks)) and **Zepto's** "Zap" agentic support ([Zepto engineering](https://blog.zepto.com/how-agentic-ai-enables-fast-reliable-customer-support-in-quickcommerce-ad7f564fc8d1)).

**From Swiggy's build:**

| Lesson | What I did with it |
|---|---|
| LLM-only routing topped out ~90%; they needed ~100% → **hybrid routing** | Rules for critical intents (cancel/refund/human) + LLM for the tail |
| Agents hallucinated from **stale memory** | "Never answer volatile data from memory" → force a fresh fetch (became ETA Truth) |
| LLM emits a **structured action**; the backend validates + executes | "LLM proposes, deterministic core disposes" |
| **Tiered models**; skip fine-tuning (catastrophic forgetting) | flash-lite / flash tiers; prompt engineering over fine-tuning |

**From Zepto's build:**

| Lesson | What I did with it |
|---|---|
| **Horizontal vs vertical agents** — cross-cutting concerns central, specialists narrow | Guardrails/PII/vision are central; FAQ vs WISMO vs order-action are focused handlers |
| **Constrained agent over deterministic state**, not a free ReAct loop | The policy core decides; the LLM only picks within a narrow space |
| A **separate deterministic guardrail** validates *every* outcome before it executes | The json-rules-engine gate, after the agent proposes |
| **Image scorer** + **cross-ticket duplicate-image** rejection (their only named fraud signal) | Vision scoring + image de-dupe as a fraud signal |
| Humans are **escalation points, not the execution layer** | Escalation gate, full context preserved |

**Why I went deep on ETA: (have personally faced issues on swiggy around this)** I researched *why* an ETA freezes at "3 min" for 20 minutes — rider GPS throttled by Android background limits, stale read-replica caches, or a stuck order state machine — and crucially, that **LLMs are "temporally blind"** The agent parrots the frozen number because it reads the same stale field with no freshness check. That became **ETA Truth**: read the *metadata*, not the number.

---

## 3. Principles

1. **Honesty over reassurance.** Never tell a customer something we can't verify is true *right now*. A truthful "I'm checking with the rider" beats a comforting "3 minutes" that's a lie — so volatile data (ETA, status, balance) is always re-derived, never parroted.
2. **The customer is never trapped.** A human is always reachable, and the bot *offers* one the moment it senses frustration — aimed squarely at the #1 complaint, bot-loops with no escape.
3. **Right-size the response to the harm.** Match the remedy to what actually went wrong — no payout for a minor gripe, no impossible proof, no under-reaction to a safety issue.
4. **Proactive beats reactive.** At a 10-minute promise, the best support ticket is the one never filed — tell the customer their order is late *before* they have to ask.
5. **Extraordinary, but scoped.** Production-grade principles (typed boundaries, idempotent money, tests on the core), prototype-sized scope — built for scale at the *seams*, with the heavy infra deferred until there's load to justify it.

---

## 4. How it works

![Architecture flowchart: channel adapter → intake → input guardrails → hybrid router, fanning out to three vertical handlers (knowledge/FAQ, ETA Truth/WISMO, order-action). The order-action path runs through the policy core and idempotent executor; all paths converge on the response composer and output guardrails, then either reply to the customer or hand off to a human via the escalation gate.](how-it-works.png)

Cross-cutting across every stage: **tracing** · **eval / bake-off** · **notifications** (SSE push) · **proactive outreach**.

**Stack** : TypeScript 6 / Node 26 (ESM) · Hono 4 · Drizzle ORM (libSQL/SQLite) · Zod 4 · React 19 / Vite 8 / Tailwind v4 · `@google/genai` v2 (Gemini 3.x).  (it's the only free model I have, still exploiting the student benefits hehe)

---

## 5. Decisions — what, why, and what I rejected

| Decision | Why | Rejected alternative |
|---|---|---|
| **Modular monolith** (a pipeline of stages — not one mega-prompt, not 5 microservices) | Matches Swiggy/Zepto's proven end-state; testable, explainable | One mega-prompt (unreliable, can't guardrail money) · a 5-service platform (5× ops overhead) |
| **Specialized vertical handlers** (FAQ · WISMO · order-action) | Each is narrow, with its own prompt + guardrails — more reliable than a generalist | One agent that does everything |
| **Hybrid router** (regex rules for critical intents + LLM for the rest) | Rule match is instant & free & 100% reliable for "cancel"/"human"/"refund status"; LLM handles paraphrase/typos/context | Pure-LLM routing (latency + cost + occasional misroute on money intents) |
| **Tiered models** (`flash-lite` for routing/sentiment, `flash` for reasoning/vision) | Keep the cheap path cheap; spend tokens only where reasoning adds value | One big model for everything (slow + expensive on the hot path) |
| **json-rules-engine policy core** | Money rules as data, not code; testable, swappable, ops-editable later | LLM decides payouts (unsafe, unauditable) |
| **Idempotent executor** (unique key + pre-check) | A refund can *never* execute twice, even on retry/double-tap | Best-effort writes (double-pay risk) |
| **ETA Truth module** | The #1 WISMO lie is a frozen ETA; recompute from distance or refuse | Parroting the cached number (Swiggy's failure) |
| **Grounded knowledge agent** (facts → LLM) | Answers the *specific* question from real data; no hallucinated policy | Keyword → canned response (misses nuance, the exact complaint) |
| **Context-aware routing** (classifier sees the pending question) | Solves "midflow intent switching" — a topic change vs an answer | A hardcoded "override intents" list (I built it, then ripped it out) |
| **SSE push + proactive sweeper** | Instant human replies; reach out *before* the customer asks | Polling only (laggy, and never proactive) |
| **Vision + cross-ticket image de-dupe** | A photo corroborates a claim; the *same image on another claim* is a fraud signal | Ignore photos · human-review every photo |
| **Layered fallbacks + I/O guardrails** | Never a dead-end "I didn't understand" loop; injection-strip, groundedness, PII | Prompt-trust / a bare retry loop |
| **Channel-agnostic core + adapters** | One brain across web + WhatsApp; the shared inbox is the source of truth | A separate bot per channel (logic drift) |

---

## 6. The features that matter

### ETA Truth — the "stuck 3 minutes" fix

`assessEta()` reasons over freshness: GPS older than 90s or an ETA not recomputed in 120s = stale. If it can, it recomputes a fresh ETA from the rider's remaining distance (~5.2 m/s city bike). If it can't, it **refuses to quote a number** and investigates ("checking with the rider and kitchen") — it never repeats a frozen one.

### Money safety — propose → gate → execute

The resolve agent emits a *proposal* (remedy + paise). Then deterministic gates fire:
- **Refunds** (cash to card) → **always** a human's sign-off.
- **Credits** → auto only if **≤ ₹500**, **corroborated**, and the photo checks out (≤ ₹200 for accounts < 7 days).
- **Missing item** → can't be photographed → **kitchen check**, never blind credit.
- **Food-safety** (foreign object, illness) → straight to a human.
- Velocity (>6 claims/7 days) or a high refund ratio → escalate.

The executor checks the idempotency key before acting; the `resolutions` table has a `unique` constraint on it. There's a test that submits the same refund twice and proves it pays once.

### Right-sized remedies

A minor, subjective gripe (coffee too bitter) gets empathy + kitchen feedback — **no money, no pointless photo request** (you can't photograph "bitter"). Money is reserved for material problems.

### Proactive + never-trapped (the moves past reactive support)

- A background job spots a **late/stuck order and messages you first** — "running ~8 min behind, here's why" — delivered over a customer-level SSE channel, anywhere in the app. Honest info, no money.
- When frustration shows (angry sentiment), the bot **offers a human** rather than making you fight for one.

---

## 7. The rest of the system

| Feature | Why it's genuinely useful |
|---|---|
| **Real WhatsApp integration** | It parses the actual Meta Cloud API webhook and builds the real Graph API send body. The *same engine* drives web and WhatsApp; the guided menu (pick order → pick issue) mirrors the app.  |
| **Shared Inbox, team-tagged** | Every channel lands in one inbox; escalations auto-tag by destination team (🍳 kitchen / 🛡️ safety / ↺ refund / 🛵 dispatch) so the right human picks up — with the full thread, never repeating. |
| **Decision trace panel** | Per turn: stage timings, model + tier, tokens, est. ₹ cost, and the policy verdict.  |
| **Photo + vision + image de-dupe** | A photo corroborates a claim (vision scores issue type / severity / confidence); the *same image reused on another claim* is a fraud signal. Degrades gracefully on an unreadable image. |
| **User memory** | Tenure, order history, prior resolutions, recent claim rate, balance — used for warmth ("after 6 great orders…") *and* for fairness/fraud (velocity + refund ratio). |
| **Sentiment + language** | en / hi / hinglish detection; an angry turn gets softer handling and a proactively-offered human. |
| **Inactivity sign-off** | A service-owned sweeper closes quiet chats with a warm, non-accusatory note — pushed live, not on the next page load. |
| **Live notifications** | A toast when a human (or the bot, after you've left) replies — even with the tab focused; proactive nudges arrive on a customer-level channel. |
| **PII redaction** | Phone / email / UPI / card masked before any text reaches Gemini or a trace/log. |
| **Graceful degradation** | LLM failure → rules fallback; transient 429/503/504 → retry + model fallback; bad image → degrade; output guard catches persona/policy leaks. |

---

## 8. Results & metrics

**Latency** (live Gemini):

| Stage | Time |
|---|---|
| Rule-matched route | **1 ms** (no model call) |
| WISMO turn (smart tier, end-to-end) | ~6.3 s |
| SSE delivery of an agent reply | **~1 ms** after send (vs up to 4 s polling) |

**Tests:** 47, on the deterministic core — policy math, ETA gates, idempotency (incl. the double-pay test), PII redaction, guardrails, rate limiting, env-config fallbacks, the full pipeline wiring, confirm-before-close, inactivity. (`tsc --noEmit` is the type gate.)

**Trace panel** surfaces, per turn: stage timings, model + tier, token counts, est. ₹ cost, and the policy verdict.

---

## 9. Why it's better than Swiggy  (since it was mentioned in the assgn doc lol)

| The complaint | Our answer |
|---|---|
| Frozen ETA ("3 min" forever) | **ETA Truth** — fresh estimate or honest "I'm checking", never a parroted number |
| Canned replies | **Grounded** answers to the specific question, from real data |
| Refund mazes / deflection | **Confirm-first, right-sized**, and money gated by deterministic rules — no runaround |
| Can't reach a human | Frustration-aware **human handoff**, with full context ("you won't repeat anything") |
| You chase the order | **We reach out first** when it's running late |
| Hollow empathy | Honest and concrete — *"it's a matter of taste, so I won't charge for it, but I've told the kitchen"* |

---

## 10. How it helps Swish

- **Deflection.** FAQs, WISMO, and most order issues resolve without a human — directly cutting ticket volume at 20k orders/day.
- **Faster human handling.** Escalations land in a Shared Inbox **tagged by destination team** (kitchen / safety / refund / dispatch) with the full thread — the human starts at the answer, not the question.
- **Higher CSAT, fewer angry loops.** Honesty (ETA Truth, no fake empathy) + proactive nudges + an always-available human turn the worst moments around.
- **Trustworthy money.** Auto-resolve the small, safe stuff; route everything risky to a human — bounded, idempotent, audited. No silent overpayments.

### Three gaps in the live Swish app — closed here

While testing Swish's current support flow I ran into three small UX gaps. Each maps to a deliberate choice in this build:

| In the current flow | How this build handles it |
|---|---|
| "Help with this order" surfaced an item list that included items from a *different* order | The item picker is scoped to the selected order on both ends (UI and backend) — the wrong order's items can't appear |
| After picking items, a session was initiated *before* any issue option was chosen | Nothing is initiated until you actively pick an option — the whole guided intake (order → issue → items) is local state, and the backend/agent is engaged only once you've made a selection |
| Separate conversations all share one scrolling chat — you scroll back to find an older issue | Every issue is its own subject-titled thread in a shared inbox, listed on Home and opened directly — no scrolling through one endless log |

---

## 11. What I deliberately did NOT build (and why)

| Skipped | Why |
|---|---|
| Auth / multi-tenant | A prototype; the seams are clean to add it.  |
| Durable queue (Kafka), workflow engine (Temporal) | No load to justify it; the interfaces are queue-ready |
| Postgres + pooling | SQLite is fine here; the repo layer makes it a near one-file swap |
| RAG / vector store | The KB is ~26 articles — it fits in the prompt; retrieval would be over-engineering. `buildFacts()` is the seam to add it. |
| Settings/CMS table for copy | Theoretical benefit at this stage; copy stays version-controlled in code.  |
| Streaming / Redis bus / cron sweeper | Documented production swaps; in-process is correct for one instance |

---

## 12. Scaling roadmap (prototype → production)

Each is a swap at a seam that already exists:

1. **Real-time at N instances** — swap the in-process bus for Redis pub/sub (one comment in `bus.ts`); same SSE layer.
2. **Service-owned jobs** — the sweeper + proactive outreach become a leader-locked cron or a durable timer (Temporal/Restate) instead of `setInterval`.
3. **Data** — Postgres + PgBouncer behind the repository layer; indexes + keyset pagination on the hot paths.
4. **Crash-safe side effects** — the outbox pattern for sends/refunds; webhook dedup by provider message id.
5. **Knowledge at scale** — embeddings + a vector store behind `buildFacts()` when the KB outgrows the prompt.
6. **AI quality as code** — a CI eval gate on a golden dataset so prompt/model changes can't silently regress (asserting *money-safety violations = 0*).
7. **Ops** — OpenTelemetry traces (we already have an internal one), SLA timers, a skills-based routing engine, PII retention/audit.

---
