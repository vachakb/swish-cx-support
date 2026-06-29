import * as z from 'zod';
import { formatINR } from '../core/money';
import type { LlmProvider } from '../llm';
import type { Message, Order, OrderItem } from '../repositories';
import type { VisionScore } from '../types';
import type { UserMemory } from './memory';

// Flat schema (no nullable nested objects) — mirrors the route/vision schemas Gemini accepts.
// remedy 'none' (or needMoreInfo) means "don't touch the wallet".
const ResolveSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'angry']),
  diagnosis: z.string(),
  needMoreInfo: z.boolean(),
  reply: z.string(),
  remedy: z.enum(['none', 'refund', 'credit', 'redeliver']),
  amountPaise: z.number().int().nonnegative(),
  reason: z.string(),
});
export type ResolveDecision = z.infer<typeof ResolveSchema>;

const SYSTEM = `You are a senior customer-support specialist for Swish, a 10-minute food delivery service that cooks in its own kitchens. Handle this order issue like a thoughtful, empathetic human agent.

How to decide:
- First UNDERSTAND the specific problem. If you lack what you need to act fairly (which item, what went wrong, how much was affected), set needMoreInfo=true, remedy="none", and make "reply" ONE warm, focused question. Never guess or act blindly.
- RESOLVE AUTONOMOUSLY wherever you reasonably can — spillage, missing or wrong items, quality/taste/texture problems, and non-delivery all deserve a fair remedy. Do NOT defer to a human for these. Only use remedy="none" for things you genuinely cannot resolve yourself (a payment/billing dispute) or when the customer explicitly asks for a person.
- Ask AT MOST ONE clarifying question for the whole conversation. If the history already shows a question from you, do NOT ask again — decide on a fair remedy now, sizing it reasonably even if a detail is missing (e.g. for a taste/texture complaint with no specific item named, credit a fair portion of the order). Never reply with a second question.
- When you can act, pick the RIGHT remedy and size amountPaise to the AFFECTED items only — not the whole order unless the whole order is affected. Never over-compensate. amountPaise is in paise (₹1 = 100 paise); use 0 when remedy is "none".
- A photo, when provided, is strong evidence — don't ask for one you already have.
- Factor in the customer's history. Be empathetic with everyone; be careful with unusually high recent claim rates.
- You only PROPOSE — a separate policy system approves and executes. Phrase replies as arranging/looking into it; never invent exact refund timelines.
- Keep "reply" warm, specific and concise (1-3 sentences). Never sound like a script.

Fields: sentiment, diagnosis (one line), needMoreInfo, reply (the customer-facing message), remedy (none|refund|credit|redeliver), amountPaise, reason.`;

function formatHistory(history: Message[]): string {
  const recent = history.slice(-8).map((m) => `${m.role}: ${m.text}`);
  return recent.length > 0 ? recent.join('\n') : '(no prior messages)';
}

export interface ResolveArgs {
  llm: LlmProvider;
  message: string;
  history: Message[];
  order: Order;
  items: OrderItem[];
  memory: UserMemory;
  image?: VisionScore;
  signal?: AbortSignal;
}

export async function resolveIssue(args: ResolveArgs): Promise<ResolveDecision> {
  const itemsText = args.items.map((i) => `${i.quantity}× ${i.name} (${formatINR(i.unitPrice)} each)`).join(', ') || 'unknown';
  const imageText = args.image
    ? `Customer attached a photo — vision read: issue=${args.image.issueType}, severity=${args.image.severity.toFixed(2)}, confidence=${args.image.confidence.toFixed(2)}.`
    : 'No photo attached.';
  const prompt = [
    `ORDER ${args.order.id} — status ${args.order.status}, total ${formatINR(args.order.total)}.`,
    `Items: ${itemsText}.`,
    `Customer memory: ${args.memory.summary}`,
    imageText,
    `Conversation so far:\n${formatHistory(args.history)}`,
    `Latest customer message: "${args.message}"`,
    'Decide the next step and return the JSON.',
  ].join('\n\n');
  return args.llm.generateJson({ task: 'resolve', tier: 'smart', system: SYSTEM, prompt, schema: ResolveSchema, signal: args.signal });
}
