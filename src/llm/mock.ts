import type { LlmProvider, LlmRequest } from './types';
import type { ZodType } from 'zod';

export type JsonResponder = (req: LlmRequest) => unknown;
export type TextResponder = (req: LlmRequest) => string;

export interface MockHandlers {
  json?: Record<string, JsonResponder>;
  text?: Record<string, TextResponder>;
}

// Deterministic provider for key-free runs and tests. Per-task responders keep it
// honest: output is validated against the same Zod schema the real model must satisfy.
export function createMockLlm(handlers: MockHandlers = {}): LlmProvider {
  return {
    name: 'mock',

    async generateText(req) {
      const handler = req.task ? handlers.text?.[req.task] : undefined;
      return handler ? handler(req) : "Thanks for reaching out to Swish — I'm on it.";
    },

    async generateJson<T>(req: LlmRequest & { schema: ZodType<T> }): Promise<T> {
      const handler = req.task ? handlers.json?.[req.task] : undefined;
      if (!handler) throw new Error(`mock LLM: no JSON handler for task "${req.task ?? 'unknown'}"`);
      return req.schema.parse(handler(req));
    },
  };
}
