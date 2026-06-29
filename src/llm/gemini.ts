import { GoogleGenAI } from '@google/genai';
import * as z from 'zod';
import type { ZodType } from 'zod';
import { config } from '../config';
import { redactPii } from '../core/redact';
import type { LlmProvider, LlmRequest } from './types';

// Faithful to @google/genai v2 `ai.models.*`. Verify against ai.google.dev when a key is present;
// the mock provider is the offline-tested path.
const TIMEOUT_MS = 18_000;
const MAX_JSON_RETRIES = 1;
// Bounded thinking for the reasoning tiers: enough to reason about a resolution, not so much it stalls the chat.
const THINKING_BUDGET = 512;

export function createGeminiLlm(apiKey: string): LlmProvider {
  const ai = new GoogleGenAI({ apiKey });

  const contents = (req: LlmRequest) => {
    // Strip PII (phone/email/UPI/card) before it leaves for a third-party model — the agent never needs it.
    const parts: Array<Record<string, unknown>> = [{ text: redactPii(req.prompt) }];
    for (const img of req.images ?? []) parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
    return [{ role: 'user', parts }];
  };

  const baseConfig = (req: LlmRequest): Record<string, unknown> => {
    const tier = req.tier ?? 'smart';
    const cfg: Record<string, unknown> = { abortSignal: req.signal, httpOptions: { timeout: TIMEOUT_MS }, maxOutputTokens: tier === 'fast' ? 256 : 2048 };
    if (req.system) cfg.systemInstruction = req.system;
    // Thinking off on the cheap routing/sentiment path; bounded thinking on the reasoning tiers.
    cfg.thinkingConfig = { thinkingBudget: tier === 'fast' ? 0 : THINKING_BUDGET };
    return cfg;
  };

  // Resilient call: retry transient 429/503/504, then fall back to the fast model if the reasoning tier is unavailable.
  const generate = async (req: LlmRequest, cfg: Record<string, unknown>) => {
    const candidates = req.tier === 'fast' ? [config.geminiModels.fast] : [config.geminiModels[req.tier ?? 'smart'], config.geminiModels.fast];
    let lastErr: unknown;
    for (const model of dedupe(candidates)) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await ai.models.generateContent({ model, contents: contents(req), config: cfg });
        } catch (e) {
          lastErr = e;
          if (!isTransient(e)) throw e;
          await sleep(300 * (attempt + 1));
        }
      }
    }
    throw lastErr;
  };

  return {
    name: 'gemini',

    async generateText(req) {
      const res = await generate(req, baseConfig(req));
      return res.text ?? '';
    },

    async generateJson<T>(req: LlmRequest & { schema: ZodType<T> }): Promise<T> {
      const cfg: Record<string, unknown> = { ...baseConfig(req), responseMimeType: 'application/json' };
      try {
        cfg.responseJsonSchema = z.toJSONSchema(req.schema);
      } catch {
        // SDK/schema mismatch — fall back to mime-type-only; Zod still validates the output.
      }
      let lastError = '';
      for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
        const res = await generate(req, cfg);
        const parsed = req.schema.safeParse(parseJson(res.text ?? ''));
        if (parsed.success) return parsed.data;
        lastError = parsed.error.message;
      }
      throw new Error(`Gemini JSON did not match schema: ${lastError}`);
    },
  };
}

const TRANSIENT = /unavailable|deadline|overloaded|high demand|rate limit|429|503|504/i;
function isTransient(e: unknown): boolean {
  return TRANSIENT.test(e instanceof Error ? e.message : String(e));
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function dedupe<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
