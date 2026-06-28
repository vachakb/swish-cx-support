import { GoogleGenAI } from '@google/genai';
import * as z from 'zod';
import type { ZodType } from 'zod';
import { config } from '../config';
import type { LlmProvider, LlmRequest, ModelTier } from './types';

// Faithful to @google/genai v2 `ai.models.*`. Verify against ai.google.dev when a key is present;
// the mock provider is the offline-tested path.
const TIMEOUT_MS = 12_000;
const MAX_JSON_RETRIES = 1;

export function createGeminiLlm(apiKey: string): LlmProvider {
  const ai = new GoogleGenAI({ apiKey });
  const modelFor = (tier: ModelTier = 'smart') => config.geminiModels[tier];

  const contents = (req: LlmRequest) => {
    const parts: Array<Record<string, unknown>> = [{ text: req.prompt }];
    for (const img of req.images ?? []) parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
    return [{ role: 'user', parts }];
  };

  const baseConfig = (req: LlmRequest): Record<string, unknown> => {
    const tier = req.tier ?? 'smart';
    const cfg: Record<string, unknown> = { abortSignal: req.signal, httpOptions: { timeout: TIMEOUT_MS }, maxOutputTokens: tier === 'fast' ? 256 : 2048 };
    if (req.system) cfg.systemInstruction = req.system;
    if (tier === 'fast') cfg.thinkingConfig = { thinkingBudget: 0 }; // thinking off keeps the cheap path cheap (256 cap stays safe)
    return cfg;
  };

  return {
    name: 'gemini',

    async generateText(req) {
      const res = await ai.models.generateContent({ model: modelFor(req.tier), contents: contents(req), config: baseConfig(req) });
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
        const res = await ai.models.generateContent({ model: modelFor(req.tier), contents: contents(req), config: cfg });
        const parsed = req.schema.safeParse(parseJson(res.text ?? ''));
        if (parsed.success) return parsed.data;
        lastError = parsed.error.message;
      }
      throw new Error(`Gemini JSON did not match schema: ${lastError}`);
    },
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
