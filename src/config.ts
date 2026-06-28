import 'dotenv/config';

type LlmProvider = 'gemini' | 'mock';

function resolveProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === 'gemini' || explicit === 'mock') return explicit;
  return process.env.GEMINI_API_KEY ? 'gemini' : 'mock';
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  llmProvider: resolveProvider(),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  // Gemini 3.x (2.5 deprecated 2026-06-17). Overridable via env; re-verify ids before relying.
  geminiModels: {
    fast: process.env.GEMINI_MODEL_FAST ?? 'gemini-3.1-flash-lite',
    smart: process.env.GEMINI_MODEL_SMART ?? 'gemini-3.5-flash',
    vision: process.env.GEMINI_MODEL_VISION ?? 'gemini-3.5-flash',
  },
  dbUrl: process.env.DATABASE_URL ?? 'file:./data/swish.db',
} as const;
