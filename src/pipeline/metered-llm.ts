import type { ZodType } from 'zod';
import type { LlmProvider, LlmRequest, LlmUsage } from '../llm';
import type { Tracer } from './tracer';

// Approximate list prices (USD per 1M tokens) for a rough cost estimate — labelled "est." in the UI,
// never used for a money action. Keyed by a substring of the model id.
const RATES: Record<'lite' | 'flash' | 'pro', { in: number; out: number }> = {
  lite: { in: 0.1, out: 0.4 },
  flash: { in: 0.3, out: 2.5 },
  pro: { in: 1.25, out: 10 },
};
const USD_TO_PAISE = 8300; // ≈ ₹83/USD

export function estimateCostPaise(u: LlmUsage): number {
  const r = u.model.includes('lite') ? RATES.lite : u.model.includes('pro') ? RATES.pro : RATES.flash;
  const paise = ((u.promptTokens * r.in + u.outputTokens * r.out) / 1e6) * USD_TO_PAISE;
  return Math.round(paise * 100) / 100; // keep 2 dp — a telemetry estimate, not integer money
}

// Wrap a provider so every model call records its model, token counts and est. cost into the turn's
// trace — without threading a callback through every call site.
export function meteredLlm(llm: LlmProvider, tracer: Tracer): LlmProvider {
  const record = (req: LlmRequest) => (u: LlmUsage) =>
    tracer.note('model', { task: req.task ?? 'llm', tier: req.tier ?? 'smart', model: u.model, inTokens: u.promptTokens, outTokens: u.outputTokens, costPaise: estimateCostPaise(u) });
  return {
    name: llm.name,
    generateJson<T>(req: LlmRequest & { schema: ZodType<T> }): Promise<T> {
      return llm.generateJson({ ...req, onUsage: req.onUsage ?? record(req) });
    },
    generateText(req: LlmRequest): Promise<string> {
      return llm.generateText({ ...req, onUsage: req.onUsage ?? record(req) });
    },
  };
}
