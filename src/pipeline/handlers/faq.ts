import { formatINR } from '../../core/money';
import * as repo from '../../repositories';
import { answerKnowledge } from '../knowledge';
import type { Handler, HandlerDeps, HandlerResult, TurnContext } from '../types';

const REFUND_PROCESSING_MS = 7 * 24 * 60 * 60 * 1000;

// Refund status is a precise, factual lookup — kept deterministic rather than handed to the LLM.
async function refundStatus(ctx: TurnContext): Promise<HandlerResult> {
  if (!ctx.customerId) return { reply: 'Happy to check your refund status — could you confirm your account?', status: 'awaiting_user' };
  const all = await repo.listResolutionsByCustomer(ctx.customerId);
  const claims = all.filter((r) => r.type === 'refund' || r.type === 'credit');
  const relevant = ctx.orderId ? claims.filter((r) => r.orderId === ctx.orderId) : claims;
  const latest = relevant[0]; // listResolutionsByCustomer is newest-first
  if (!latest) {
    return { reply: "I don't see any refunds or credits in progress for this order. If you're expecting one, tell me what went wrong and I'll sort it right away.", status: 'resolved', data: { kind: 'refund_status', count: 0 } };
  }
  const ageMs = Date.now() - new Date(latest.createdAt).getTime();
  const processing = latest.type === 'refund' && ageMs < REFUND_PROCESSING_MS;
  const where = latest.type === 'credit' ? 'your Swish balance' : 'your original payment method';
  const phase = processing ? `is on its way to ${where} (within 7 business days of confirmation)` : `is done — it's in ${where}`;
  return {
    reply: `Your ${latest.type === 'credit' ? 'Swish credit' : 'refund'} of ${formatINR(latest.amount ?? 0)} for "${latest.reason}" ${phase}.`,
    status: 'resolved',
    data: { kind: 'refund_status', id: latest.id },
  };
}

export const faqHandler: Handler = {
  intents: ['faq', 'referral_status', 'refund_status'],
  async handle(ctx, deps) {
    if (ctx.route.intent === 'refund_status') return refundStatus(ctx);
    const answer = await answerKnowledge({ llm: deps.llm, message: ctx.input.text, history: ctx.history.slice(0, -1), customerId: ctx.customerId, providers: deps.providers });
    return {
      reply: answer.reply,
      status: answer.needsFollowup ? 'awaiting_user' : 'resolved',
      polish: false,
      // When it asks a follow-up (e.g. "which area?"), mark it so the reply routes back here in context.
      data: answer.needsFollowup ? { kind: 'clarify', intent: 'faq', topic: 'knowledge' } : { kind: 'faq' },
    };
  },
};
