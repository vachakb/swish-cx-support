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
  dbUrl: process.env.DATABASE_URL ?? 'file:./data/swish.db',
} as const;
