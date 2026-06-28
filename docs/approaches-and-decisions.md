# Approaches & Decisions (living pro/con log)

> This is the seed of the assignment deliverable: *"comprehensive explanation of the various approaches and why we chose what we chose."*
> Format: each decision lists Options → Pros/Cons → Recommendation → Status. We update this as we build.
> Status legend: 🟢 decided · 🟡 leaning · 🔵 open (needs Vacha/Swish input).

---

## 0. First-principles problem decomposition

**The job:** a customer has a question or a problem. Resolve it *correctly, instantly, and kindly*, with minimal human intervention — but **escalate gracefully** when we shouldn't automate.

Every support contact is one of two kinds, split by **what knowledge it needs** and **what risk it carries**:

- **(A) Knowledge / FAQ** — answerable from a knowledge base; little/no user state; **read-only**; low risk. *e.g. "how does referral work", "are you in Indiranagar?"*
- **(B) Order / account-specific** — needs **live user/order data** and often an **action**; higher risk (money, trust, abuse). Splits further:
  - **(B1) Order-informational** — read-only but needs *live* data. *e.g. "where is my order", "what's my ETA".* Emotionally hot at a 10-min SLA.
  - **(B2) Action / resolution** — needs a decision + a write action, sometimes evidence (photo). *e.g. spillage, missing item, wrong order, cancel, refund.* High-stakes, abuse-prone.

> ⚠️ **Sharp edge worth calling out:** the brief lists *"I referred my friend, where is my referral reward"* under FAQ — but it's actually a **hybrid**: it needs the user's *live referral balance* (a tool call), not generic FAQ text. Many "FAQ-looking" queries are secretly data queries. Our router must classify by *what data/action is required*, not by surface wording.

**This yields the pipeline** the rest of this doc designs:
`intake → input guardrails → hybrid router → context load → specialized handler → deterministic policy core → action executor → response + escalation gate`, with **tracing** and **eval** as cross-cutting concerns.

---

## 1. Overall architecture style
**Options:** (a) one big prompt/agent does everything; (b) **layered pipeline: hybrid router → specialized vertical handlers → deterministic policy/action core**; (c) full multi-service event-driven platform (Zepto's 5 services + Kafka/CDC).
- **(a)** Pro: fastest to write. Con: poor reliability/explainability, hard to guardrail money actions, degrades on multi-intent (both blogs explicitly moved *away* from this).
- **(b)** Pro: matches the proven Swiggy/Zepto end-state; testable, explainable, safe to put money behind; right size for a lean team. Con: more upfront structure than a single prompt.
- **(c)** Pro: independent scaling at millions/day. Con: "5× operational overhead" (Zepto's own words); massive over-engineering for an MVP and a ~16-person eng team.
- **Recommendation:** **(b)** — implemented as a **modular monolith** (the "services" are modules behind one deploy). 🟢

## 2. Routing / intent classification
**Options:** (a) pure LLM; (b) pure rules/regex; (c) **hybrid: deterministic rules for critical/high-confidence intents + small fast LLM for the ambiguous tail**.
- **(a)** Pro: flexible, handles paraphrase. Con: ~90% ceiling (Swiggy's finding) — unacceptable when misrouting can trigger a wrongful refund.
- **(b)** Pro: 100% predictable, cheap. Con: brittle to phrasing, can't handle the long tail.
- **(c)** Pro: deterministic where it must be (refund/cancel/WISMO short-circuit), flexible where it can be; cheap (small model). Con: two code paths to maintain.
- **Recommendation:** **(c)**. Critical money/safety intents get a rule short-circuit; everything else goes to a small classifier model returning `{intentFamily, intent, confidence}`; low confidence → clarify or escalate. 🟢

## 3. Knowledge / FAQ answering
**Options:** (a) full RAG with a vector DB; (b) **lightweight retrieval over a small curated KB (embedded in-process or keyword+small-embeddings)**; (c) policy/FAQ text stuffed directly into the prompt.
- **(a)** Pro: scales to a big corpus, semantic. Con: infra + chunking/eval overhead; overkill for an MVP-sized KB; Zepto shows structured-data flows often don't need it.
- **(b)** Pro: semantic enough, no infra, fast, easy to ground+cite. Con: doesn't scale to thousands of docs (fine for MVP).
- **(c)** Pro: trivial. Con: prompt bloat, no citation, scales poorly, violates SOP-grid "show only the relevant slice."
- **Recommendation:** **(b)** for the MVP, with the retrieval interface abstracted so it can be swapped for a real vector DB later. Pair with the **SOP-grid** idea so only the relevant policy slice is injected. 🟡

## 4. Agent orchestration
**Options:** (a) framework (LangGraph / similar); (b) **hand-rolled vertical handlers + a deterministic SOP-grid state machine**; (c) autonomous ReAct planner.
- **(a)** Pro: batteries included. Con: heavy dependency, indirection, less control over the money path; we'd fight the framework on guardrails.
- **(b)** Pro: full control, transparent, easy to test/guardrail, matches Zepto's "constrained agent over deterministic state." Con: we write the orchestration ourselves (but it's small).
- **(c)** Pro: maximally flexible. Con: least predictable — wrong tool for refunds/money; both blogs avoided open planning.
- **Recommendation:** **(b)**. 🟢

## 5. Action safety (refunds / cancels / credits / re-deliver)
**Options:** (a) LLM directly calls the write API; (b) **LLM emits a structured proposal → deterministic policy engine validates → idempotent executor performs the action, re-validating live state**.
- **(a)** Pro: simple. Con: unacceptable — a hallucination = real money lost; no audit trail; abuse-prone.
- **(b)** Pro: LLM never holds write authority; deterministic eligibility + fraud checks; idempotent + auditable; matches both blogs' "action-signal / policy guardrail" pattern. Con: more layers.
- **Recommendation:** **(b)** — non-negotiable. 🟢

## 6. Refund / fraud decisioning (the part the blogs hid — our differentiator)
**Options:** (a) trust the LLM's judgment; (b) **deterministic, config-driven rules engine over risk signals**.
- Signals: refund amount vs. **configurable cap**, **claim velocity** (refunds/time), **lifetime refund ratio**, account age, order corroboration (does live order data support the claim?), **image integrity** (perceptual-hash cross-ticket dedupe + tamper heuristics), linked-account hints.
- **(a)** Pro: handles nuance. Con: inconsistent, exploitable, not auditable, regulatory risk.
- **(b)** Pro: consistent, auditable, tunable, abuse-resistant; mirrors Swish's own JSON-rules-engine culture. Con: we must define + tune thresholds (instrument and iterate).
- **Recommendation:** **(b)** — auto-approve when *all* low-risk conditions hold (Swish's vertical integration gives strong corroboration), else add friction or escalate. Every threshold lives in config. 🟢

## 7. Evidence / image handling (spillage, missing, wrong item)
**Options:** (a) ignore photos; (b) **vision model "image scorer" + horizontal integrity checks**; (c) require human for all photo claims.
- **(b)** Pro: enables confident auto-resolution of the hard q-commerce cases (Zepto's edge); integrity checks deter fraud. Con: needs a vision-capable model; more work.
- **Recommendation:** **(b)**, but scope for MVP TBD (real vision call vs. a mocked scorer with a real integrity-check pipeline). 🔵 *(see open questions)*

## 8. Model strategy
**Options:** (a) one big model; (b) **tiered (small for routing/classification, capable for reasoning/generation, vision for images)**; (c) fine-tune.
- **(b)** Pro: cost + latency wins (Swiggy's lesson). **(c)** Con: catastrophic forgetting, poor ROI (Swiggy abandoned it).
- **Recommendation:** **(b)**, no fine-tuning. Provider abstracted behind an interface. 🟢

## 9. Conversation state / memory
**Options:** (a) stateless; (b) **stateful sessions** (history + order context + prior actions), keyed by conversation id.
- **Recommendation:** **(b)** — needed for "this is late again" / multi-turn; but volatile data is *always* re-fetched, never trusted from memory. 🟢

## 10. Escalation to human
**Options:** (a) confidence-threshold only; (b) **multi-trigger gate**.
- Triggers: low router confidence · guardrail/safety trip · N failed tool calls or repeated dissatisfaction · intent outside the automatable allow-list (safety, fraud, ID) · explicit "talk to a human." Handoff carries the full trace.
- **Recommendation:** **(b)** — and *always* offer the escape (directly attacks Swish's "unreachable support" pain). 🟢

## 11. Observability & evaluation
- **Tracing:** per-turn structured spans (intent, state, tool calls, proposal, guardrail verdict, action, latency, tokens). 🟢
- **Eval:** **sample → replay → LLM-as-judge** on correctness / groundedness / resolution / tone; runnable as a script over a seed conversation set. 🟢

## 12. Tech stack
**TypeScript + Node is sufficient and a good fit** (aligns with Swish's RN/TS world; first-class LLM SDKs). Add: an LLM SDK (vision-capable), **Zod** for typed tool I/O + structured outputs, a light web framework, light persistence (in-memory/SQLite for MVP), structured trace logs. **No** Python, Databricks, Kafka, or microservices needed for the MVP. 🟡 *(provider TBD — see open questions)*

---

## 13. Channels & shared inbox (req: plug into a UI *and* WhatsApp)
**Options:** (a) a separate bot per channel; (b) **channel-agnostic core + adapters + a shared-inbox conversation store**; (c) full event-driven platform (Zepto's 5 services).
- **(a)** Con: logic duplicated per channel; drift.
- **(b)** Pro: one brain, omnichannel; all channels normalize to a canonical `InboundMessage`; the shared inbox is the single source of truth + where humans pick up escalations (Zepto's "ticketing service"). Con: must define the canonical message + adapter contracts.
- **(c)** Con: massive over-build for a prototype.
- **Recommendation:** **(b)**. WhatsApp shipped as a **simulated WABA** (adapter written to the real WhatsApp Business API webhook/message contract, so it's swap-ready) — a real WABA needs Meta approval + a number, out of scope for a prototype. 🟢

## 14. Sentiment analysis — needed? where?
**Options:** (a) ignore; (b) **inline structured signal emitted by the router/intake LLM pass**; (c) a dedicated sentiment model/service.
- **(a)** Con: miss the frustrated, late-order user who should reach a human faster.
- **(b)** Pro: ~free (same model call that classifies intent also returns `sentiment`/`frustration`), low-latency; consumed *deterministically* by the escalation gate (high frustration + late order → escalate sooner / proactive credit), by tone adaptation, and by eval (CSAT proxy). The agentic design already produces it — we just make it explicit and act on it. Con: not a calibrated classifier (fine for routing nudges).
- **(c)** Con: extra latency/cost/infra for marginal gain at this scale.
- **Recommendation:** **(b)** — yes it's helpful, no separate component needed. 🟢

## 15. Persistence & schema (req: play-arena DB, good eng decisions)
**Options:** (a) in-memory; (b) **SQLite via a typed ORM (Drizzle) behind a repository interface**; (c) match Swish's MongoDB now.
- **(a)** Con: no arena persistence, no audit trail.
- **(b)** Pro: zero-setup (runs anywhere instantly — key for a reviewer), type-safe, real schema/migrations, trivially swappable to Postgres; repo interface keeps the core DB-agnostic. Con: relational ≠ their Mongo (mitigated: schema follows Mongo conventions — camelCase, string ids, `isValid`, timestamps — so the mapping is mechanical).
- **(c)** Con: a running Mongo to demo the prototype; more setup friction.
- **Recommendation:** **(b)**, schema designed to map cleanly to Swish's Mongo. Entities: `profiles`, `orders`, `orderItems`, `orderTracking` (with the ETA staleness metadata), `wallet`/`referrals`, `serviceability`, `conversations` (shared inbox), `messages`, `attachments`/`claimEvidence` (pHash + integrity verdict + vision score), `resolutions`/`actionsLedger` (idempotent), `auditLog`, `scenarios` (seeded arena cases), `evalRuns`/`benchResults`. 🟢

## 16. Graceful fallbacks (req: never annoying, never a dead end)
**Options:** (a) retry/clarify loop; (b) **layered graceful degradation**.
- **(a)** Con: the "I didn't understand that" loop — Swish's documented pain.
- **(b)** Layer 1: low confidence → **one** clarifying question (capped, never repeated). Layer 2: still stuck / out of scope → concrete options + human escalation with context. Layer 3: LLM/backend **unreachable** → a **deterministic offline responder** (acknowledge, surface last-known order status, offer human/callback, set expectations). Always an exit; never a loop.
- **Recommendation:** **(b)**. 🟢

## 17. Guardrails — garbage IN and garbage OUT (req)
- **Input guard:** empty/gibberish/over-length/spam, abuse/toxicity, **prompt-injection strip**, PII detection, off-topic redirect → structured `inputAssessment`.
- **Output guard:** Zod schema validation · **groundedness check** (no claim unsupported by tool data — *especially the ETA*) · tone/brand · action-within-policy · PII-leak. Fail → retry once with correction → deterministic fallback.
- **Recommendation:** explicit pre + post guards (not prompt-trust). 🟢

## 18. Image evidence for product claims (req: user can send a photo)
**Options:** (a) skip; (b) mock scorer + real integrity pipeline; (c) **real vision scoring behind an interface + mock fallback**, always integrity-checked.
- **Recommendation:** **(c)** — accept one image on order-action claims; horizontal validation (perceptual-hash **cross-ticket dedupe** + tamper/validity + relevance) runs always; the freshness/damage score uses real Claude vision when a key is present, else a deterministic mock. Feeds the policy core. Keeps it real but not heavy. 🟢 *(supersedes the earlier open question on evidence depth)*

## 19. ETA Truth / staleness module ★ (req: fix the stuck-ETA experience)
**Decision:** a first-class module (see `research.md` Part E). The order-info handler reasons over a **trust verdict** `{displayEta, isStale, isStuck, isBreached, confidence, recommendedAction}` derived from ETA metadata + deterministic gates — never the raw number. Low confidence → honest + proactive, never parrots. The arena seeds a stuck-ETA order to demo naïve-bot-vs-ours. 🟢

## 20. Scalability posture (req: ready for 100k+ users, without over-building)
**Decision:** demonstrate the *measures*, document the *path*. Stateless core (session/state behind a Redis-ready interface); **idempotent actions** with keys; **async escalation via a queue-ready event bus** (in-process now, swappable); rate-limiting + per-user concurrency; swappable provider adapters; tracing + metrics; no session affinity. A `docs` "path to 100k+" section names what we'd add (Redis, real queue, autoscaled stateless workers, read replicas) — *not* built for the prototype. 🟢

## 21. Plug-and-play contract (req: drop into Swish's app)
**Decision:** provider interfaces matching Swish's confirmed conventions (REST/JSON camelCase, string ids, JWT/`x-auth-key`, `isValid`/timestamps); **policy expressed in their own `@swishhq/rule-engine` JSON**; field-map config for the not-yet-public domain fields. Ship mocks; Swish swaps adapters. (See `research.md` Part F.) 🟢

## 22. Build-and-benchmark the contested choices (req)
**Decision:** a small **bake-off harness** (reuses the eval rig) measuring **latency + accuracy** on a labeled scenario set, for decisions where the answer isn't obvious. **Primary contest: routing** — rules-only vs LLM-only vs hybrid vs embeddings-classifier. **Secondary (time-permitting):** FAQ retrieval (keyword vs embeddings) and responder model-tier (small vs large). Output a comparison table; pick winners by accuracy/latency/cost; record in this doc. 🟢

## 23. Notification service (req: show agent replies when the user leaves the chat)
**Why it matters:** support is async — proactive ETA alerts, a human's reply post-escalation, or a delayed resolution can land *after* the user navigated away. Silence here *is* the "unreachable support" pain.
**Options:** (a) none (user must stay on screen); (b) client polling; (c) **server-push + presence-aware notification service**.
- **Recommendation (c):** a `NotificationService` abstraction with pluggable transports. *Prototype:* server pushes replies over SSE/WebSocket; the client uses the **Page Visibility API** to detect the chat isn't focused → raises a **Web Notification** (with permission) + an in-app unread badge/toast; on WhatsApp the outbound message itself is the notification. *Production (same interface):* Web Push (VAPID), **FCM/APNs** for the RN app, WhatsApp. Triggers: proactive updates, escalated human replies, async resolutions. 🟢

## 24. UI tech — pure React web (decided with Vacha)
Pure React (web) SPA: chat + a phone-framed in-app view + the WhatsApp surface + shared inbox + play arena, all in the browser. The engine is client-agnostic (REST/JSON), so the production RN chat is a thin client over the same API + message contract. An RN-Web chat widget was offered for extra "drops-into-your-app" credibility but declined to keep it lightweight. 🟢

## Methodology — how this doc proves its claims (answers "should we actually test the approaches?")
Two classes of decision, handled differently — deliberately:
- **Empirically benchmarked** (several viable options; the winner depends on measurable tradeoffs): **routing** (rules vs LLM vs hybrid vs embeddings), **retrieval** (keyword vs embeddings), **responder model tier** (flash-lite vs flash). Each is built behind a shared interface and run through the **bake-off harness** (§22) over a labeled scenario set → we report **accuracy / latency / cost** and pick. These numbers go in the deliverable as *measured fact*, not assertion.
- **Settled by evidence + first principles** (building variants would be wasteful, or it's a safety/correctness invariant): e.g. "the LLM never holds refund authority," "no fine-tuning," "modular monolith over microservices." The doc gives the options + reasoned pros/cons + cites the research. Running an A/B to "prove" an LLM shouldn't issue refunds would be theatre.
This split *is* the senior judgment: empirical where it's decision-relevant and cheap, reasoned-and-cited everywhere else — thorough without overengineering.

## Refinements (v3)
- **§10 (LLM):** target **Gemini 3.x** — `gemini-3.1-flash-lite` (routing/sentiment), `gemini-3.5-flash` (vision/balanced), Gemini 3 Pro (reasoning). **Gemini 2.5 was deprecated 2026-06-17.** Model ids live in config; re-verify against ai.google.dev before relying.
- **§5/§21 (policy engine):** `@swishhq/rule-engine` is **not published to npm** (public repo, unpublished). We build on its upstream **`json-rules-engine`** (same JSON rule shape) behind our own interface, so Swish swaps in their fork with one line.
- **§13 (WhatsApp):** *not a fake* — the adapter implements the **real WhatsApp Cloud API contract** (webhook in, Graph API send out). The built-in simulator drives **real webhook-shaped payloads through the real code path**; an **optional real-Meta mode** (Meta app creds + a tunnel) sends actual WhatsApp messages. Same honest pattern as the Gemini mock. Exact contract **verified against Meta docs at build time**.
- **Rigor principle (global):** everything we build or cite is verified against current official docs — no invented APIs / model-ids / behaviors; uncertainty is flagged. A prototype, built with production principles.

---

## Resolved (from Vacha's requirements, 2026-06-28)
- **MVP surface** → engine + Swish-styled **responsive chat UI** + **WhatsApp simulator** + **play arena** + shared-inbox/escalation view.
- **LLM provider & runnability** → Claude (vision-capable) behind a provider interface, **deterministic mock fallback so it runs key-free**; real key unlocks full power. *(Confirm if Vacha has a key.)*
- **Evidence depth** → real vision + always-on integrity pipeline (decision 18).
- **Multilingual** → design-ready (language signal + translate-shim); demo in English. 🟡 (low priority unless Vacha wants Hinglish demoed live)

---

## Decision changelog
- _(v1)_ Initial framework from competitor + Swish research. Decisions 1,2,4,5,6,8,9,10,11 recommended; 3,7,12 leaning/open; 4 open questions raised.
- _(v2)_ Folded in Vacha's expanded requirements + ETA root-cause research + confirmed Swish stack. Added decisions 13–22 (channels/shared-inbox, sentiment, persistence/schema, fallbacks, I/O guardrails, image evidence, **ETA Truth ★**, scalability, plug-and-play via `@swishhq/rule-engine`, bake-off). Resolved the 4 open questions. Next: scaffold + build.
- _(v3)_ Added decisions 23 (notification service) + 24 (UI = pure React web) + the empirical-vs-reasoned **methodology** note. Refinements: Gemini **3.x** (2.5 deprecated 2026-06-17), `json-rules-engine` (since `@swishhq/rule-engine` is unpublished), WhatsApp **real Cloud API contract** + simulator + optional real mode, global **verify-don't-assume** rigor principle. Wrote `CLAUDE.md` (root + `web/`) from version-verified stack research; hardened tsconfig (`verbatimModuleSyntax`, `erasableSyntaxOnly`).
