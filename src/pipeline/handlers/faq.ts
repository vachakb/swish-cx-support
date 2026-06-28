import { formatINR } from '../../core/money';
import * as repo from '../../repositories';
import type { Handler, HandlerDeps, HandlerResult, TurnContext } from '../types';

const KB = [
  {
    id: 'referral_how',
    re: /(how.*(referr?al|refer)|referr?al.*(work|program)|refer a friend)/i,
    answer:
      "Swish referrals are simple: share your code, and when a friend places their first order and it's delivered, you both get ₹50 in Swish credit — added to your balance automatically.",
  },
  {
    id: 'refund_policy',
    re: /(refund policy|how.*refund|when.*refund|money back|how long.*refund)/i,
    answer:
      "If something's wrong with an order I can usually fix it on the spot — either instant Swish credit or a refund to your original payment method. Card/UPI refunds typically land in 3-5 business days; Swish credit is instant.",
  },
];

const SERVICEABILITY = /serviceable|deliver(y)? to|available in|do you (deliver|serve)|in my area|not serviceable/i;

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
  intents: ['faq', 'referral_status'],
  async handle(ctx, deps) {
    if (ctx.route.intent === 'referral_status') return referralStatus(ctx, deps);
    const text = ctx.input.text;
    if (SERVICEABILITY.test(text)) return serviceability(text, deps);
    const kb = KB.find((k) => k.re.test(text));
    if (kb) return { reply: kb.answer, status: 'resolved', data: { kind: 'faq', id: kb.id } };
    return { reply: 'Happy to help! Is this about referrals, serviceable areas, cancellations, or an order?', status: 'awaiting_user' };
  },
};
