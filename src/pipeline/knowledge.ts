import * as z from 'zod';
import { formatINR } from '../core/money';
import type { LlmProvider } from '../llm';
import type { Providers } from '../providers/types';
import * as repo from '../repositories';
import type { Message } from '../repositories';


const KnowledgeSchema = z.object({
  reply: z.string(),
  needsFollowup: z.boolean(), // true when we're asking the customer something (e.g. which area) → keep the thread open
});
export type KnowledgeAnswer = z.infer<typeof KnowledgeSchema>;

const SYSTEM = `You are a Swish customer-support specialist (10-minute food delivery, own kitchens, Bengaluru). Answer the customer's question warmly and concretely, using ONLY the FACTS provided.
- Whether we deliver somewhere: check the serviceable areas and name the place in your reply. If they ask about delivery but name no place, ask which area (needsFollowup=true).
- Referrals: answer the SPECIFIC thing asked — where to find rewards vs how much is pending vs how the program works — don't just recite the balance if that's not what they asked.
- Use the help articles for policy/how-to questions.
- If the FACTS don't cover it, give an honest, helpful reply and offer to bring in a teammate — NEVER invent app screens, prices, timelines, or policies you weren't given.
- Swish voice: warm, concrete, personal, a couple of sentences. Never sound like a script or a form.
Set needsFollowup=true only when you're asking the customer for more information; otherwise false.`;

async function buildFacts(customerId: string | undefined, providers: Providers): Promise<string> {
  const [areas, articles] = await Promise.all([repo.listServiceability(), repo.listFaqArticles()]);
  const live = areas.filter((a) => a.serviceable).map((a) => a.area);
  const soon = areas.filter((a) => !a.serviceable).map((a) => `${a.area}${a.note ? ` (${a.note})` : ''}`);
  const lines = [
    'Swish is a 10-minute food-delivery service. We cook in neighbourhood kitchens ("Pods") and deliver within roughly a 1 km radius of each, currently across Bengaluru and expanding to new cities. Exact coverage depends on the customer\'s precise address, which the app checks instantly.',
    `Areas confirmed live: ${live.join(', ') || 'none'}. Not yet live: ${soon.join(', ') || 'none'}, and anywhere outside our current Bengaluru kitchens. If unsure about a specific address, tell them the app confirms coverage instantly.`,
  ];
  if (customerId) {
    const wallet = await providers.wallet.getWallet(customerId);
    if (wallet) {
      lines.push(
        `This customer's referral: code ${wallet.referralCode}; ${formatINR(wallet.referralRewardPending)} pending (credited when a referred friend's first order is delivered); ${formatINR(wallet.referralRewardEarned)} already earned. Rewards and Swish credit show up in their Swish wallet/balance in the app. Current credit balance: ${formatINR(wallet.creditBalance)}.`,
      );
    }
  }
  lines.push('Help articles:');
  for (const a of articles) lines.push(`- Q: ${a.question} A: ${a.answer}`);
  return lines.join('\n');
}

export interface KnowledgeArgs {
  llm: LlmProvider;
  message: string;
  history: Message[];
  customerId?: string;
  providers: Providers;
  signal?: AbortSignal;
}

export async function answerKnowledge(args: KnowledgeArgs): Promise<KnowledgeAnswer> {
  const facts = await buildFacts(args.customerId, args.providers);
  const recent = args.history.slice(-6).map((m) => `${m.role}: ${m.text}`).join('\n') || '(none)';
  const prompt = [`FACTS:\n${facts}`, `Conversation so far:\n${recent}`, `Customer's question: "${args.message}"`, 'Answer using only the facts. Return JSON.'].join('\n\n');
  return args.llm.generateJson({ task: 'knowledge', tier: 'fast', system: SYSTEM, prompt, schema: KnowledgeSchema, signal: args.signal });
}
