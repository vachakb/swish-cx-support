import { formatINR } from '../../core/money';
import * as repo from '../../repositories';
import type { Handler, HandlerDeps, HandlerResult, TurnContext } from '../types';

const SERVICEABILITY = /serviceable|deliver(y)? to|available in|do you (deliver|serve)|in my area|not serviceable/i;
const REFUND_PROCESSING_MS = 5 * 24 * 60 * 60 * 1000;

async function refundStatus(ctx: TurnContext, deps: HandlerDeps): Promise<HandlerResult> {
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
  const phase = processing ? `is on its way to ${where} (usually 3-5 business days)` : `is done — it's in ${where}`;
  return {
    reply: `Your ${latest.type === 'credit' ? 'Swish credit' : 'refund'} of ${formatINR(latest.amount ?? 0)} for "${latest.reason}" ${phase}.`,
    status: 'resolved',
    data: { kind: 'refund_status', id: latest.id },
  };
}

function areaMatches(area: string, text: string): boolean {
  return area
    .toLowerCase()
    .split(' ')
    .some((token) => token.length > 2 && new RegExp(`\\b${token}\\b`, 'i').test(text));
}

async function referralStatus(ctx: TurnContext, deps: HandlerDeps): Promise<HandlerResult> {
  if (!ctx.customerId) {
    return { reply: 'Happy to check your referral reward — could you confirm the number on your Swish account?', status: 'awaiting_user' };
  }
  const wallet = await deps.providers.wallet.getWallet(ctx.customerId);
  if (!wallet) {
    return { reply: "I couldn't pull up your rewards just now — let me get a teammate to check.", status: 'escalated', escalationReason: 'wallet lookup failed' };
  }
  if (wallet.referralRewardPending > 0) {
    return {
      reply: `You've got ${formatINR(wallet.referralRewardPending)} in referral rewards on the way! It lands in your Swish balance the moment your friend's first order is delivered. (Your code: ${wallet.referralCode})`,
      status: 'resolved',
      data: { kind: 'referral', pending: wallet.referralRewardPending, earned: wallet.referralRewardEarned },
    };
  }
  if (wallet.referralRewardEarned > 0) {
    return {
      reply: `Your referral rewards (${formatINR(wallet.referralRewardEarned)}) are already in your Swish balance. Share code ${wallet.referralCode} to earn more!`,
      status: 'resolved',
      data: { kind: 'referral', earned: wallet.referralRewardEarned },
    };
  }
  return {
    reply: `No referral rewards yet — share your code ${wallet.referralCode} and you'll get ₹50 once a friend's first order is delivered.`,
    status: 'resolved',
    data: { kind: 'referral' },
  };
}

async function serviceability(text: string, deps: HandlerDeps): Promise<HandlerResult> {
  const areas = await repo.listServiceability();
  const hit = areas.find((a) => areaMatches(a.area, text));
  if (!hit) {
    return { reply: "Which area or city are you asking about? Tell me and I'll check if Swish delivers there.", status: 'awaiting_user' };
  }
  if (hit.serviceable) {
    return {
      reply: `Yes — Swish delivers in ${hit.area}! If the app ever says otherwise for you, tell me and I'll dig into it.`,
      status: 'resolved',
      data: { kind: 'serviceability', area: hit.area, serviceable: true },
    };
  }
  return {
    reply: `We're not live in ${hit.area} just yet${hit.note ? ` (${hit.note})` : ''} — but we're expanding fast. I can note your interest so you hear the moment we launch there.`,
    status: 'resolved',
    data: { kind: 'serviceability', area: hit.area, serviceable: false },
  };
}

export const faqHandler: Handler = {
  intents: ['faq', 'referral_status', 'refund_status'],
  async handle(ctx, deps) {
    if (ctx.route.intent === 'referral_status') return referralStatus(ctx, deps);
    if (ctx.route.intent === 'refund_status') return refundStatus(ctx, deps);
    const text = ctx.input.text;
    if (SERVICEABILITY.test(text)) return serviceability(text, deps);
    const article = await repo.searchFaq(text); // DB-backed; same content as the self-serve Help module
    if (article) return { reply: article.answer, status: 'resolved', data: { kind: 'faq', id: article.id } };
    return { reply: 'Happy to help! Is this about referrals, serviceable areas, cancellations, or an order?', status: 'awaiting_user' };
  },
};
