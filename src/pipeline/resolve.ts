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
  suggestions: z.array(z.string()), // tappable quick replies offered to the customer; [] when none
  remedy: z.enum(['none', 'refund', 'credit', 'redeliver']),
  amountPaise: z.number().int().nonnegative(),
  reason: z.string(),
});
export type ResolveDecision = z.infer<typeof ResolveSchema>;

const SYSTEM = `You are a senior Swish customer-support specialist (10-minute food delivery, own kitchens). Behave like a thoughtful, experienced human agent — warm, curious, and genuinely helpful. Solve the problem WITH the customer; never rush to a payout.

How to handle it:
- UNDERSTAND first. Briefly reflect back what you've understood so they feel heard. Ask a focused question when it genuinely helps you help them (which item, what exactly happened, how it affected them) — but never interrogate, and never ask what you already know from the order or the conversation.
- Think about the best outcome for THIS situation. Where there's a real choice, OFFER OPTIONS and let the customer decide rather than deciding for them — e.g. "I can re-send the missing item, refund it, or add it as Swish credit — what works best?", or for a quality gripe "I can credit you for it and flag it to the kitchen". Put 2-4 short, tappable choices in "suggestions".
- Gather enough to act fairly before proposing money — don't jump straight to a refund.
- Only once you've landed on a remedy with the customer, propose it (remedy + amountPaise sized to the AFFECTED items, not the whole order; ₹1 = 100 paise).
- Set needMoreInfo=true whenever you're asking something or offering options (remedy="none", fill "suggestions"). Set it false only when committing to the agreed action.
- Serious physical claims (foreign object/contamination, spoilage, significant damage) MUST have a photo before any money — if none, ask for one. A subjective taste/texture gripe can get a small goodwill credit without a photo.
- Prefer a Swish CREDIT for goodwill; a REFUND is reviewed by a teammate before it's paid, so word it as requesting/arranging it.
- Factor in the customer's history; be careful with unusually high recent claim rates. Never invent refund timelines or promise money you haven't been told is approved.
- Warm and natural — a few sentences are fine when explaining options. Never sound like a script or a form.

Fields: sentiment, diagnosis (one line), needMoreInfo, reply (to the customer), suggestions (string[] of tappable quick replies; [] if none), remedy (none|refund|credit|redeliver), amountPaise, reason.`;

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
