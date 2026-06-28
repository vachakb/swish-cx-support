# Research & Insights

> Living research log for the Swish automated-support assignment. Sources at the bottom.
> Status: v1 (initial research). Owner: Vacha.

---

## Part A — North star: who Swish is, and what "great support" means for *them*

**Swish** (Munchmart Technologies Pvt Ltd, HSR Layout, Bengaluru) is a **10-minute food delivery** startup, founded 2024 by **Aniket Shah (CEO), Ujjwal Sukheja, and Saran S.** (`saranonearth` — the reviewer of this assignment). Funded ~$54M over 3 rounds in 18 months (Accel seed → Series A → $38M Series B, Mar 2026, Hara Global + Bain Capital Ventures). Well-capitalized but **lean engineering core (~16 engineers)** around a large ops workforce.

### Why Swish is structurally different from the blogs we studied
| | Swiggy / Zomato | Zepto / Blinkit | **Swish** |
|---|---|---|---|
| What they sell | Third-party restaurant food (marketplace) | Packaged grocery SKUs | **Food they cook themselves** |
| Asset model | Asset-light marketplace | Dark stores | **Owned kitchens ("Pods") + own fleet — vertically integrated** |
| Who's at fault when an order is wrong | Restaurant (dispute middleman) | Warehouse pick error | **Swish itself — full ownership of the chain** |
| Data available to support | Partial (merchant-owned) | Good | **Ground-truth at every step: kitchen → pack → rider → customer** |

**The single most important implication:** because Swish owns the kitchen, the packing, and the rider, it has **ground-truth data and the authority to fix things at every step**. There is no merchant to dispute with. This means an automated support agent can **auto-resolve far more confidently** than a marketplace's bot can — we can *know* whether an item was packed, *know* where the rider is, and *issue the fix instantly*. We should design around this advantage, not against it.

### Swish's stated values (our design compass)
**Quality / freshness · Speed · Reliability** — all justified by end-to-end control. Brand voice is warm and concrete ("Chai should arrive when it rains, not after it stops"; "Every order runs the same way, every time").

### Documented customer-experience pain (what to beat)
From app-store reviews and category reporting:
- **10-min promise frequently missed** (orders arriving 20+ min).
- **Support rated rude / unreachable**; bot-loops with no human escape.
- **Slow, opaque refunds** (policy says up to 7 business days; no cancellation after acceptance).
- Category-wide: CCPA probing q-commerce refund practices; FSSAI logged 21,042 grievances.

➡️ **"A Swiggy-like support but better experience <3" therefore concretely means:** instant + accurate, **no bot-loops**, **transparent fast refunds/credits**, **always a clear human escape**, and **proactive** (tell the user the order is late *before* they have to ask).

### Engineering culture signals (shapes our tech choices)
Public `SwishHQ` GitHub: **Go backend, React Native + TypeScript frontend, MongoDB, Cloudflare R2, a JSON rules engine, self-hosted OTA server, Better Stack status page, a security disclosure program.** Tagline: *"Engineering delightful systems."*
➡️ They will value an **API-native, programmable, config-driven** support system (their JSON rules engine is a tell). TypeScript is squarely in their world.

### Benchmark to be aware of
Zomato's **"Nugget"** support AI: ~15M conversations/month, ~85% resolution. The bar for "good" in Indian food delivery support is already high and public.

---

## Part B — Swiggy's enterprise support agent (Databricks blog)

> Caveat: it's a platform-marketing post — rich on the *journey* and lessons, thin on model names, RAG specifics, and the concrete tool list. Patterns are the gold, not the numbers.

**The architecture evolved in ~7 phases** (this arc is itself the playbook):
1. Two-tier LLM: **intent-identification layer** + **response-formatting layer**.
2. Add **RAG** for knowledge answers (early version was stateless → context loss).
3. **Agentic / graph execution** — intent handlers as graph branches (maintainable, extensible).
4. Model selection (tiered).
5. Tuning + robust eval.
6. Prompt engineering (meta-prompting, CoT, ReAct).
7. **Multi-agent + decoupled routing.**

**Most actionable lessons:**
- **Separate the router from the responder.** Two stages from day one.
- **Don't let the LLM route alone** — LLM-only routing hit only ~90% accuracy; they wanted ~100%. Fix = **hybrid routing**: deterministic rules/triggers for high-confidence + critical intents (refund, cancel, WISMO) + a **small dedicated classifier LLM** for the ambiguous tail.
- **Multi-agent > mega-agent** — one specialized agent per "disposition," each with its own focused prompt + tools.
- **Force tool calls for fresh data.** Their agents hallucinated from **stale memory**; fix = tag data **static vs. dynamic**, and *require* a tool call (don't make it optional) before answering anything volatile (ETA, status, balance).
- **Decouple actions from the agent.** The LLM emits a **structured action signal**; the CRM/backend validates eligibility and executes. **The LLM never holds write authority.**
- **Tiered models** cut cost + latency (simple / small-reasoning / large-reasoning).
- **Skip fine-tuning** — they hit catastrophic forgetting; concluded prompt engineering is the better ROI.
- **Eval + tracing are not optional** — LLM-as-judge on *sampled* traffic; trace every step.
- Realistic **deflection ≈ 60%** (their "100% automated" is a marketing framing of an automatable subset). Don't anchor on 100%.
- **Gap they ignored:** multilingual / Hinglish — very relevant for an India-facing app.

**Portability:** every *idea* is portable to plain TS/Node + an LLM API. Databricks supplies managed plumbing (AI Gateway, Model Serving, MLflow, Unity Catalog), not irreplaceable capability.

---

## Part C — Zepto's "Zap" agentic support (Zepto engineering blog ×2)

**Outcomes (credible figures):** ~75% tickets auto-resolved (up from 48%), 90%+ CSAT, **p90 resolution 24→13 min (−46%)**, ≥50% cost vs. third-party vendor, absorbs 10x traffic bursts, 200–500ms message latency.

**The central design ideas (highest-value, most reusable):**
- **Two-axis agent model:**
  - **Horizontal agents** = cross-cutting concerns enforced *centrally*: authentication, context verification, **image validation** (quality, relevance, tamper detection, cross-ticket duplicate rejection).
  - **Vertical agents** = deep specialists, deliberately **narrow**, **least-privilege tools**. Two families: **chat-based** (WISMO) and **product-based** (spillage/missing/wrong → claim validation → image scoring → policy → decision).
- **SOP Grid** (★ the single most reusable pattern): compute a **deterministic state = f(intent, order state, delay severity)**, then **index into the one narrowly-scoped SOP/policy slice** relevant right now. Don't dump the whole policy book into context. It's a **state machine that selects the prompt/policy slice** → reliability, explainability, smaller prompts.
- **Constrained agent over deterministic state — NOT a free-roaming ReAct loop.** The LLM reasons + selects within a narrow, pre-indexed action space. (Their platform literally splits a deterministic **Bot Service** from a generative **Agentic Service**.)
- **Chain-of-Thought before action** — explicit reasoning over "what the SOP allows + current order state + what the customer asked" *before* proposing an action. Kills fabricated ETAs/refund timelines and stale-context leakage.
- **Separate, deterministic Policy Guardrail pass** — *every* proposed outcome is validated for compliance/safety *after* the agent decides, before it executes. Not prompt-trust.
- **Image Scorer** — vision model scores freshness / spoilage / expiry / defect severity for product claims.
- **Escalation Gate** — humans are **escalation points, not the primary execution layer**. Handoff on ambiguity, risk, or "automation reached its limits," with full context preserved. (Interesting: customers often *choose* the AI path even when offered a human.)
- **Automated eval** — "manual audits don't scale; evaluation itself had to be automated": **sample real (anonymized) conversations → replay → score** on correctness / latency / conversation quality (and claim accuracy for image cases).
- **Tracing + correlation IDs from day one.**

**What Zepto deliberately did NOT disclose (we must design these ourselves):**
- **Refund auto-approve vs. escalate thresholds**, **fraud/abuse heuristics**, confidence cutoffs. The *only* fraud mechanisms they name are on the **image layer** (tamper + duplicate-image detection). → This is **our** biggest design-it-yourself area, and where senior judgment shows.

**Start-up-appropriate take:** you do NOT need their 5 microservices / Kafka / Debezium / EKS. Start as a **modular monolith** (their "services" become modules). They're structured-data-driven (no vector DB named) — our support logic is mostly **order state + policy rules**, not document search.

---

## Part D — Synthesized insights → principles for Swish's build

1. **Two stages: cheap hybrid router → specialized responder.** Rules for risky/critical intents, small LLM for the tail.
2. **Specialized vertical handlers, not one mega-prompt.** FAQ agent (read-only) vs order-info agent vs order-action agent — separate prompts, tools, guardrails.
3. **SOP-grid policy core (deterministic).** `state = f(intent, orderState, severity, userRisk)` → scoped policy slice → auto-resolve or escalate.
4. **LLM proposes, deterministic core disposes.** All money/actions (refund, credit, cancel, re-deliver) go through a typed, idempotent executor that re-validates live state. LLM never holds write authority.
5. **Never answer volatile data from memory.** Force a fresh tool call for ETA / order status / balance — *critical at a 10-minute SLA*.
6. **Own the fraud/abuse layer.** Amount caps, claim velocity, lifetime refund ratio, account age, order corroboration, image integrity (perceptual-hash dedupe + tamper checks). All thresholds = config, not code.
7. **Always a graceful human escape, with full context.** Multi-trigger escalation; never a bot-loop. This directly attacks Swish's documented pain.
8. **Proactive > reactive.** At a 10-min SLA, detect lateness and reach out first.
9. **Tiered models; no fine-tuning.** Prompt engineering + good eval beats fine-tuning ROI.
10. **Trace every turn; eval on sampled/replayed traffic from day one.**
11. **Exploit vertical integration:** ground-truth data + owned fix = confident auto-resolution a marketplace can't match.
12. **Plan for Hinglish/multilingual** (the gap both incumbents under-served).

---

## Part E — Root cause: why live ETAs freeze & why the agent parrots them ★

> Answers Vacha's requirement: "in Swiggy the ETA is stuck at 3 min for 20 min and the agent still says 3 min — why, and can we fix it?" This is our signature feature.

**How ETAs work:** a routing baseline + an ML **residual** recomputed *per request* from fresh rider GPS + live traffic (Uber DeepETA serves this in ~3 ms). They're **deliberately biased to under-promise** (asymmetric loss — "a minute late is worse than a minute early"; Uber & DoorDash).

**Why they freeze (ranked by evidence):**
1. **Rider GPS pings stop/lag** *(best documented)* — Android throttles background location to "a few times an hour," Doze suspends network, OEMs kill apps, poor network + urban GPS drift (~30 m). No fresh GPS → distance can't shrink → ETA coasts on last inputs. (Android dev docs.)
2. **Stale cache / read-replica lag** — lost invalidations can leave a cached value stale *indefinitely* (arXiv cache-freshness; Uber moved fulfillment to bounded-staleness reads to fix exactly this).
3. **Order state machine stuck** between transitions → status + ETA freeze together (Uber Statecharts; DoorDash delivery states).
4/5. **Display floor / monotonic "never-increase" smoothing** — plausible (under-promise bias + UX norms against rising timers) but **NOT documented in any primary source. Do not assert as fact.**

**Why the support agent repeats the stale number:**
- It reads the **same cached ETA field** the app does, with **no freshness gate**.
- **LLMs are "temporally blind"** — ACL 2026 (arXiv 2510.23853): *no model exceeded 65% timing alignment even when given timestamps; timestamps appear in <4% of reasoning traces.* Even with the data, the model won't reason about elapsed time unless forced.
- A **frozen value is statistically invisible** to anomaly detection ("looks like normal data") — needs an explicit domain rule.

**The fix — our `ETA Truth` module:** don't read the number, read its **metadata** (`etaLastComputedAt`, `riderLastGpsAt`, `stateLastTransitionAt`, `promisedBy`, `distanceRemaining`, server `now`) → run deterministic gates: **GPS-stale** (>~90 s), **ETA-stuck** (eta + distance unchanged while elapsed grows — the exact "3-min-for-20-min" signature), **state-stall**, **promise-breach** → a **confidence score**. Low confidence ⇒ never parrot; be honest + **act** (proactive credit / re-dispatch / escalate) + force a live re-fetch (counters temporal blindness). This is "force a fresh tool call," taken one level deeper: **detect staleness in the source of truth, not just in conversation memory.**

*Sources:* Uber DeepETA (blog + arXiv 2206.02127); Android background-location/Doze docs; arXiv 2412.20221 (cache freshness); Uber fulfillment re-architecture; arXiv 2510.23853 (LLM temporal blindness); DoorDash/Swiggy ETA posts (snippet-level).

---

## Part F — Swish's tech stack (CONFIRMED) → the plug-and-play contract

From `SwishHQ` GitHub (esp. the `spread` OTA service) + their status page:
- **Backend:** Go + **Fiber v2**; clean layered (controller→service→repository→model); `validator/v10`; Zap logs; Cobra CLI.
- **Data:** **MongoDB** (ObjectID `_id`, camelCase JSON exposing `id`, soft-delete `isValid`, `createdAt`/`updatedAt`/`createdBy`); **Cloudflare R2** for blobs (AWS S3 SDK).
- **API:** REST/JSON; dual surface — human `/core/*` behind **JWT bearer**, machine `/bundle/*` behind **`x-auth-key`**. No gRPC/GraphQL; no public OpenAPI.
- **Rules engine:** they publish **`@swishhq/rule-engine`** (npm) — JSON rules with **0–1 scoring + weights** (fork of json-rules-engine).
- **Frontend:** React Native + TS (mobile, OTA via `spread`); Vite + React + TS (web dashboard).
- **Ops:** Better Stack status (`status.justswish.tech`); Docker/compose; GitHub Actions; env via godotenv.
- **Not public:** food-delivery domain models (orders/riders/pods/wallet) → design behind interfaces + a **field-map config**.

**Our plug-and-play contract:**
- Thin **provider interfaces** returning Mongo-shaped camelCase JSON (string ids, `isValid`, timestamps): `OrdersProvider`, `TrackingProvider` (incl. the ETA metadata above), `WalletProvider` (balance / referrals / credit), `ActionExecutor` (idempotent: cancel / refund / credit / redeliver / reassign), optional `Store/PodProvider`.
- **Policy expressed as `@swishhq/rule-engine` JSON** — we use *their own package*, so Swish can author/persist the same refund/eligibility/escalation rulesets. (Major plug-and-play win.)
- Auth pluggable (JWT / x-auth-key); config via env; field-map for unknown domain fields. Swish swaps mock → real services with near-zero glue.

*Sources:* github.com/SwishHQ (`spread`, `sparkles.rule-engine`); status.justswish.tech.

---

## Sources
- Databricks — *Redefining Customer Support: Swiggy's Enterprise-Scale AI Agent*: https://www.databricks.com/blog/redefining-customer-support-swiggys-enterprise-scale-ai-agent-built-databricks
- Zepto — *How Agentic AI Enables Fast, Reliable Customer Support in QuickCommerce*: https://blog.zepto.com/how-agentic-ai-enables-fast-reliable-customer-support-in-quickcommerce-ad7f564fc8d1
- Zepto — *Building Zepto's AI-First Support Platform: A 0→1 Engineering Story*: https://blog.zepto.com/building-zeptos-ai-first-support-platform-a-0-1-engineering-story-81efb4a479d5
- AWS — *How Zepto scales to millions of orders/day using DynamoDB* (backend infra context)
- Swish: TechCrunch / Entrackr / YourStory coverage; `SwishHQ` GitHub; justswish.in. (Entity: Munchmart Technologies Pvt Ltd.)
- Refund-automation / fraud-abuse best practice: Retell AI, Ravelin.
