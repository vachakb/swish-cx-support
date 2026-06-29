import * as z from 'zod';
import type { LlmProvider } from '../llm';
import type { Message } from '../repositories';

const WismoSchema = z.object({
  reply: z.string(),
  escalate: z.boolean(),
});
export type WismoDecision = z.infer<typeof WismoSchema>;

export interface WismoFacts {
  status: string;
  reliable: boolean; // can we quote a trustworthy ETA?
  freshEtaMinutes: number | null;
  minutesLate: number; // 0 if within promise
  riderDistanceKm: number | null;
  gpsMinutesAgo: number | null;
  severe: boolean;
}

const SYSTEM = `You are a Swish support specialist answering "where's my order?" for a 10-minute food delivery. Warm, concise, genuinely helpful, and HONEST.

Rules:
- Use ONLY the facts given. NEVER invent or repeat an ETA marked unreliable — that is the cardinal sin (don't be the app that says "3 min" for twenty minutes).
- If a fresh ETA is available, give it plainly and reassure.
- If the order is late, acknowledge it directly and say what you're doing about it.
- If the ETA is UNRELIABLE: be upfront that you can't give an exact time right now. Share what you DO know (the rider's last-known distance, how late it is), and offer concrete next steps — you're checking with the rider and the kitchen, you'll update them the moment it moves, and they can watch it live in the app.
- Do NOT offer, promise, or mention money, credits, or refunds — a delay is not auto-compensated.
- Set escalate=true ONLY when the order is severely late AND the tracking is unreliable (a teammate should chase it). Otherwise false.

Return only JSON: { reply, escalate }.`;

function factSheet(f: WismoFacts): string {
  return [
    `Order status: ${f.status}.`,
    f.reliable && f.freshEtaMinutes != null ? `Fresh ETA: about ${f.freshEtaMinutes} minute(s) away.` : 'Live ETA: UNRELIABLE — do not quote a number.',
    f.minutesLate > 0 ? `It is ${f.minutesLate} min past the promised time.` : 'It is within the promised time.',
    f.riderDistanceKm != null ? `Rider last-known distance: ~${f.riderDistanceKm} km away.` : 'Rider location: unknown.',
    f.gpsMinutesAgo != null ? `Rider GPS last updated ~${f.gpsMinutesAgo} min ago.` : 'No recent rider GPS.',
    `Severity: ${f.severe ? 'severe' : 'normal'}.`,
  ].join('\n');
}

export async function composeWismo(args: { llm: LlmProvider; facts: WismoFacts; message: string; history: Message[]; signal?: AbortSignal }): Promise<WismoDecision> {
  const history = args.history.slice(-6).map((m) => `${m.role}: ${m.text}`).join('\n') || '(none)';
  const prompt = [`FACTS:\n${factSheet(args.facts)}`, `Conversation so far:\n${history}`, `Customer asked: "${args.message}"`, 'Reply as JSON.'].join('\n\n');
  return args.llm.generateJson({ task: 'wismo', tier: 'smart', system: SYSTEM, prompt, schema: WismoSchema, signal: args.signal });
}
