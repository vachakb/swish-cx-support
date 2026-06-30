import 'dotenv/config';

type LlmProvider = 'gemini' | 'mock';

// Treat blank/whitespace env values as unset — e.g. the empty override lines copied from .env.example.
// (`??` would keep an empty string; `||`-style fallback + trim avoids the "model is required" class of bug.)
export const envOr = (value: string | undefined, fallback: string): string => {
  const v = value?.trim();
  return v ? v : fallback;
};

function resolveProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === 'gemini' || explicit === 'mock') return explicit;
  return envOr(process.env.GEMINI_API_KEY, '') ? 'gemini' : 'mock';
}

const corsRaw = envOr(process.env.CORS_ORIGINS, 'http://localhost:5173,http://localhost:4173');

export const config = {
  port: Number(envOr(process.env.PORT, '8787')),
  nodeEnv: envOr(process.env.NODE_ENV, 'development'),
  isProd: process.env.NODE_ENV === 'production',
  llmProvider: resolveProvider(),
  geminiApiKey: envOr(process.env.GEMINI_API_KEY, ''),
  // Gemini 3.x (2.5 deprecated 2026-06-17). Overridable via env; re-verify ids before relying.
  geminiModels: {
    fast: envOr(process.env.GEMINI_MODEL_FAST, 'gemini-3.1-flash-lite'),
    smart: envOr(process.env.GEMINI_MODEL_SMART, 'gemini-3.5-flash'),
    vision: envOr(process.env.GEMINI_MODEL_VISION, 'gemini-3.5-flash'),
  },
  dbUrl: envOr(process.env.DATABASE_URL, 'file:./data/swish.db'),
  // In-process rate limiting (per client IP). RATE_LIMIT_ENABLED=false disables it (e.g. in tests).
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: Number(envOr(process.env.RATE_LIMIT_WINDOW_MS, '60000')),
    global: Number(envOr(process.env.RATE_LIMIT_GLOBAL, '200')),
    chat: Number(envOr(process.env.RATE_LIMIT_CHAT, '30')),
  },
  // CORS allowlist. '*' allows any origin (local-dev convenience); otherwise an explicit comma-separated list.
  corsOrigins: corsRaw === '*' ? '*' : corsRaw.split(',').map((o) => o.trim()).filter(Boolean),
  // WhatsApp Cloud API. With access token + phone-number id set, sends are real; otherwise sim mode.
  whatsapp: {
    verifyToken: envOr(process.env.WHATSAPP_VERIFY_TOKEN, 'swish-verify'),
    accessToken: envOr(process.env.WHATSAPP_ACCESS_TOKEN, ''),
    phoneNumberId: envOr(process.env.WHATSAPP_PHONE_NUMBER_ID, ''),
    graphBase: envOr(process.env.WHATSAPP_GRAPH_BASE, 'https://graph.facebook.com/v21.0'),
    live: Boolean(envOr(process.env.WHATSAPP_ACCESS_TOKEN, '') && envOr(process.env.WHATSAPP_PHONE_NUMBER_ID, '')),
  },
} as const;
