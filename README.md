# Swish Support Copilot

Automated customer-support engine for **Swish** (10-minute food delivery). It resolves FAQ and order-specific issues end-to-end, escalates gracefully to a human when it should, and is built to plug into Swish's own stack.

> 🚧 In active development. Full design rationale lives in [`docs/`](./docs).

## Why it's different
- **ETA Truth** — detects stuck/stale tracking instead of parroting "arriving in 3 mins" for 20 minutes.
- **LLM proposes, deterministic core disposes** — money actions (refunds/credits) never ride on a model's say-so alone.
- **Omnichannel** — one engine behind a web chat UI and WhatsApp, with a shared inbox.
- **Plug-and-play** — provider interfaces matching Swish's conventions (Go/Fiber, Mongo, JWT); policy expressed as swappable JSON rules.

## Docs
- [Research & insights](docs/research.md)
- [Approaches & decisions](docs/approaches-and-decisions.md)

## Getting started
Coming soon (scaffolding in progress).
