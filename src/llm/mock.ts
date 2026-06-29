import { config } from '../config';
import type { LlmProvider, LlmRequest, LlmUsage } from './types';
import type { ZodType } from 'zod';

export type JsonResponder = (req: LlmRequest) => unknown;
export type TextResponder = (req: LlmRequest) => string;

export interface MockHandlers {
  json?: Record<string, JsonResponder>;
  text?: Record<string, TextResponder>;
}

// Rough token estimate (~4 chars/token) so trace cost/token numbers are non-zero on key-free runs.
function estimateUsage(req: LlmRequest, output: string): LlmUsage {
  const approx = (s: string) => Math.ceil(s.length / 4);
  return { model: config.geminiModels[req.tier ?? 'smart'], promptTokens: approx((req.system ?? '') + req.prompt), outputTokens: approx(output) };
}

// Deterministic provider for key-free runs and tests. Per-task responders keep it
// honest: output is validated against the same Zod schema the real model must satisfy.
export function createMockLlm(handlers: MockHandlers = {}): LlmProvider {
  return {
    name: 'mock',

    async generateText(req) {
      const handler = req.task ? handlers.text?.[req.task] : undefined;
      const out = handler ? handler(req) : "Thanks for reaching out to Swish — I'm on it.";
      req.onUsage?.(estimateUsage(req, out));
      return out;
    },

    async generateJson<T>(req: LlmRequest & { schema: ZodType<T> }): Promise<T> {
      const handler = req.task ? handlers.json?.[req.task] : undefined;
      if (!handler) throw new Error(`mock LLM: no JSON handler for task "${req.task ?? 'unknown'}"`);
      const result = handler(req);
      req.onUsage?.(estimateUsage(req, JSON.stringify(result)));
      return req.schema.parse(result);
    },
  };
}
