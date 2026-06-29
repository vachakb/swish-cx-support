import { formatINR } from '../../core/money';
import { decideClaim } from '../../policy/engine';
import { computeRiskSignals } from '../../policy/signals';
import type { ActionRequest } from '../../providers/types';
import type { Order, OrderItem } from '../../repositories';
import type { VisionScore } from '../../types';
import { assessImage } from '../image';
import { buildUserMemory } from '../memory';
import { resolveIssue } from '../resolve';
import type { ResolveDecision } from '../resolve';
import type { Handler, HandlerDeps, HandlerResult, TurnContext } from '../types';
import { pickOrderId } from './util';

const CANCELLABLE = new Set(['placed', 'preparing']);
// Food-safety claims (foreign object, contamination, illness) never auto-resolve — a human reviews them.
const SERIOUS = /\b(bug|insect|cockroach|roach|worm|maggot|hair|glass|plastic|metal|foreign|contaminat|mou?ld|rotten|spoil|expired|sick|ill|vomit|food pois|allerg)/i;
type Remedy = ResolveDecision['remedy'];

async function handleCancel(ctx: TurnContext, deps: HandlerDeps, order: Order): Promise<HandlerResult> {
  if (!CANCELLABLE.has(order.status)) {
    return {
      reply: `That order's already ${order.status} — since we cook fresh and fast, I can't cancel it now. But if anything's off when it arrives, tell me and I'll fix it right away.`,
      status: 'resolved',
      data: { kind: 'cancel', allowed: false },
    };
  }
  const action: ActionRequest = {
    type: 'cancel',
    orderId: order.id,
    conversationId: ctx.conversation.id,
    customerId: order.customerId,
    reason: 'customer requested cancel',
    idempotencyKey: `${ctx.conversation.id}:cancel:${order.id}`,
  };
  const res = await deps.providers.executor.execute(action);
  if (res.status === 'failed') {
    return { reply: `I couldn't cancel that — ${res.message}. Let me get a teammate to help.`, status: 'escalated', escalationReason: res.message };
  }
  const lead = res.status === 'duplicate' ? "That order's already cancelled" : "Done — I've cancelled your order";
  return {
    reply: `${lead}, and ${formatINR(order.total)} goes back to your original payment method. Anything else?`,
    status: 'resolved',
    action,
    data: { kind: 'cancel', allowed: true, amount: order.total },
  };
}

// Turn the agent's proposed remedy into a concrete, idempotent action for the executor.
function toAction(remedy: Remedy, amountPaise: number, reason: string, order: Order, ctx: TurnContext): ActionRequest | null {
  const amount = Math.min(amountPaise, order.total);
  const base = {
    conversationId: ctx.conversation.id,
    customerId: order.customerId,
    reason,
    idempotencyKey: `${ctx.conversation.id}:${remedy}:${order.id}`,
  };
  if (remedy === 'refund') return { type: 'refund', orderId: order.id, amount, ...base };
  if (remedy === 'credit') return { type: 'credit', orderId: order.id, amount, ...base };
  if (remedy === 'redeliver') return { type: 'redeliver', orderId: order.id, ...base };
  return null;
}

async function handleIssue(ctx: TurnContext, deps: HandlerDeps, order: Order, items: OrderItem[]): Promise<HandlerResult> {
  const memory = await buildUserMemory(order.customerId, deps.providers);

  // A photo is scored once and checked for reuse across tickets, then fed to the agent as evidence.
  let image: VisionScore | undefined;
  let imageDuplicate = false;
  if (ctx.input.image) {
    const assessment = await assessImage(deps.llm, ctx.conversation.id, ctx.input.image, ctx.input.text);
    deps.tracer.note('image', { duplicate: assessment.duplicate, issueType: assessment.score.issueType, severity: assessment.score.severity });
    image = assessment.score;
    imageDuplicate = assessment.duplicate;
  }

  // The agent diagnoses, decides whether it needs more info, and proposes a right-sized remedy.
  const decision = await resolveIssue({
    llm: deps.llm,
    message: ctx.input.text,
    history: ctx.history.slice(0, -1), // drop the just-stored current message
    order,
    items,
    memory,
    image,
  });
  deps.tracer.note('resolve', { diagnosis: decision.diagnosis, sentiment: decision.sentiment, needMoreInfo: decision.needMoreInfo, remedy: decision.remedy, amountPaise: decision.amountPaise });

  // Conduct/safety report, payment dispute, or anything outside an order remedy → hand to a human WITH the context the agent gathered.
  if (!decision.needMoreInfo && decision.remedy === 'escalate') {
    return { reply: decision.reply, status: 'escalated', escalationReason: decision.diagnosis || 'needs a teammate', polish: false, suggestions: decision.suggestions, data: { kind: 'resolution', diagnosis: decision.diagnosis, outcome: 'escalate' } };
  }

  // Clarifying question or no money action → reply and wait, don't touch the wallet.
  const acting = !decision.needMoreInfo && decision.remedy !== 'none' && (decision.remedy === 'redeliver' || decision.amountPaise > 0);
  if (!acting) {
    return { reply: decision.reply, status: 'awaiting_user', polish: false, suggestions: decision.suggestions, data: { kind: 'clarify', diagnosis: decision.diagnosis } };
  }

  // Food-safety claims never auto-pay, photo or not — a human reviews them with priority.
  if (SERIOUS.test(ctx.input.text) || SERIOUS.test(decision.diagnosis)) {
    return {
      reply: "I'm really sorry — a possible food-safety issue like this is something I want our team to review properly and fast. I've flagged it with all the details (a photo helps if you have one), and a teammate will be straight in touch to make it right.",
      status: 'escalated',
      escalationReason: `possible food-safety issue ("${decision.diagnosis}") — manual review`,
      polish: false,
      data: { kind: 'resolution', diagnosis: decision.diagnosis, outcome: 'manual_review' },
    };
  }

  // Deterministic safety gate: caps, fraud velocity, corroboration, image reuse. LLM proposes, this disposes.
  const action = toAction(decision.remedy, decision.amountPaise, decision.reason, order, ctx);
  if (!action) return { reply: decision.reply, status: 'awaiting_user', polish: false, data: { kind: 'clarify' } };
  const corroborated = order.status === 'delivered' && (!image || (image.issueType !== 'none' && image.issueType !== 'unclear' && image.confidence >= 0.5));
  const signals = await computeRiskSignals(order.customerId, deps.providers);
  const policy = await decideClaim({ action, signals, corroborated, imageDuplicate });
  deps.tracer.note('policy', { outcome: policy.outcome, reasons: policy.reasons });

  if (policy.outcome === 'auto_approve') {
    const amount = 'amount' in action ? action.amount : 0;
    // Refunds (cash back to the original method) always get a teammate's sign-off — never moved silently.
    if (action.type === 'refund') {
      return {
        reply: `Thanks for the details, and I'm sorry about this. I've put through a refund request for ${formatINR(amount)} — a teammate will review and process it shortly, and you'll get a confirmation the moment it's done.`,
        status: 'escalated',
        escalationReason: `refund of ${formatINR(amount)} proposed for "${decision.diagnosis}" — awaiting human approval`,
        polish: false,
        data: { kind: 'resolution', diagnosis: decision.diagnosis, remedy: 'refund', amount, outcome: 'manual_approval' },
      };
    }
    const res = await deps.providers.executor.execute(action);
    if (res.status === 'failed') return { reply: 'I hit a snag arranging that — let me get a teammate on it right away.', status: 'escalated', escalationReason: res.message, polish: false };
    return {
      reply: decision.reply,
      status: 'resolved',
      action,
      polish: false,
      data: { kind: 'resolution', diagnosis: decision.diagnosis, remedy: decision.remedy, amount, outcome: 'auto_approve' },
    };
  }

  const why = policy.reasons.join('; ');
  const reply =
    policy.outcome === 'deny'
      ? "Thanks for flagging this — I can't process it automatically, so I'm bringing in a teammate to take a closer look. You won't have to repeat anything."
      : "I hear you, and I want to get this exactly right. I'm looping in a teammate now who'll sort it out — you won't have to repeat anything.";
  return { reply, status: 'escalated', escalationReason: why, polish: false, data: { kind: 'resolution', diagnosis: decision.diagnosis, outcome: policy.outcome, reasons: policy.reasons } };
}

export const orderActionHandler: Handler = {
  intents: ['order_issue', 'cancel_order'],
  async handle(ctx, deps) {
    const prefer = ctx.route.intent === 'cancel_order' ? 'cancellable' : 'delivered';
    const orderId = ctx.orderId ?? (await pickOrderId(deps.providers, ctx.customerId, prefer));
    if (!orderId) return { reply: "Sure — which order is this about? Tap it from your orders list and I'll jump right in.", status: 'awaiting_user' };
    if (ctx.route.intent === 'cancel_order') {
      const order = await deps.providers.orders.getOrder(orderId);
      if (!order) return { reply: "I couldn't find that order — could you double-check it?", status: 'awaiting_user' };
      return handleCancel(ctx, deps, order);
    }
    const details = await deps.providers.orders.getOrderDetails(orderId);
    if (!details) return { reply: "I couldn't find that order — could you double-check it?", status: 'awaiting_user' };
    return handleIssue(ctx, deps, details.order, details.items);
  },
};
