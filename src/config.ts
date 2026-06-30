import 'dotenv/config';

type LlmProvider = 'gemini' | 'mock';

function resolveProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === 'gemini' || explicit === 'mock') return explicit;
  return process.env.GEMINI_API_KEY ? 'gemini' : 'mock';
}

const corsRaw = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173').trim();

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
  // In-process rate limiting (per client IP). RATE_LIMIT_ENABLED=false disables it (e.g. in tests).
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    global: Number(process.env.RATE_LIMIT_GLOBAL ?? 200),
    chat: Number(process.env.RATE_LIMIT_CHAT ?? 30),
  },
  // CORS allowlist. '*' allows any origin (local-dev convenience); otherwise an explicit comma-separated list.
  corsOrigins: corsRaw === '*' ? '*' : corsRaw.split(',').map((o) => o.trim()).filter(Boolean),
  // WhatsApp Cloud API. With access token + phone-number id set, sends are real; otherwise sim mode.
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'swish-verify',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    graphBase: process.env.WHATSAPP_GRAPH_BASE ?? 'https://graph.facebook.com/v21.0',
    live: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  },
} as const;
