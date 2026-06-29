import * as z from 'zod';
import type { LlmProvider } from '../llm';
import { intents, sentiments } from './types';
import type { Intent, RouteResult, Sentiment } from './types';

const RouteSchema = z.object({
  intent: z.enum(intents),
  confidence: z.number().min(0).max(1),
  sentiment: z.enum(sentiments),
  language: z.string(),
  orderRef: z.string().optional(),
});

const ROUTE_SYSTEM = `Classify a customer's message for Swish food-delivery support and return JSON.
intent is one of: ${intents.join(', ')}.
greeting=hi/hello; faq=general questions (how referral works, serviceability, policy); referral_status=asking where their referral reward is; order_status=where is my order / ETA; order_issue=spillage/missing/wrong/damaged item; cancel_order=cancel request; human=wants a person; closing=thanks/that's all/goodbye (issue resolved); unknown=anything else.
Also return confidence 0-1, sentiment (positive|neutral|negative|angry), and language (en|hi|hinglish).`;

// Deterministic rules for the costly/critical intents — never gambled on a probabilistic classifier.
// Order matters — earlier rules win. Referral/reward is checked before order_status so
// "where is my referral reward" doesn't get caught by the "where is" tracking pattern.
const RULES: Array<{ re: RegExp; intent: Intent }> = [
  { re: /\b(human|agent|representative|real person|talk to (someone|a person))\b/i, intent: 'human' },
  { re: /\bcancel\b/i, intent: 'cancel_order' },
  { re: /(referr|invite|invitation|reward|cashback)/i, intent: 'referral_status' },
  { re: /(spill|spilt|leak|soak|missing|didn'?t (get|receive)|only (got|received)|received only|wrong (order|item)|incorrect|not what i ordered|damag|broke|crush|smash|stale|rotten)/i, intent: 'order_issue' },
  { re: /(where('?s| is)|how (far|long)|track|\beta\b|arriv|still not here|not (yet )?(arrived|delivered))/i, intent: 'order_status' },
  { re: /\b(serviceable|deliver to|available in|do you (deliver|serve)|in my area)\b/i, intent: 'faq' },
  // Checked last so substantive intents win (e.g. "thanks, but where's my order?" → order_status).
  { re: /\b(thanks|thank you|that'?s all|that'?s it|all good|nothing else|no that'?s (it|all)|bye|cheers)\b/i, intent: 'closing' },
];

const ANGRY = /(ridiculous|terrible|worst|pathetic|fed up|unacceptable|disgusting|!!!|cheated|scam|useless)/i;
const NEGATIVE = /(late|still waiting|not happy|disappointed|cold|wrong|missing|spill|delay|where is|annoyed)/i;
const POSITIVE = /(thanks|thank you|great|awesome|love|appreciate|perfect)/i;

export function detectSentiment(text: string): Sentiment {
  if (ANGRY.test(text)) return 'angry';
  if (POSITIVE.test(text)) return 'positive';
  if (NEGATIVE.test(text)) return 'negative';
  return 'neutral';
}

export function detectLanguage(text: string): string {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/\b(kahan|kab|mera|nahi|kyun|bhej|raha)\b/i.test(text)) return 'hinglish';
  return 'en';
}

export function ruleIntent(text: string): Intent | null {
  for (const r of RULES) if (r.re.test(text)) return r.intent;
  return null;
}

export function tailIntent(text: string): Intent {
  if (/\b(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you)\b/i.test(text)) return 'greeting';
  if (/\b(how|what|why|policy|works?|charges?|fee|menu|veg|hours)\b/i.test(text)) return 'faq';
  return 'unknown';
}

const ORDER_REF = /\b(ord_[a-z0-9]+|#[A-Za-z0-9]{4,})\b/;
function extractOrderRef(text: string): string | undefined {
  return text.match(ORDER_REF)?.[1];
}

// Hybrid: rules short-circuit the critical intents; a cheap model classifies the rest.
export async function route(text: string, llm: LlmProvider, signal?: AbortSignal): Promise<RouteResult> {
  const ruled = ruleIntent(text);
  if (ruled) {
    return { intent: ruled, confidence: 0.95, sentiment: detectSentiment(text), language: detectLanguage(text), orderRef: extractOrderRef(text) };
  }
  return llm.generateJson({ task: 'route', tier: 'fast', system: ROUTE_SYSTEM, prompt: text, schema: RouteSchema, signal });
}

export { RouteSchema };
