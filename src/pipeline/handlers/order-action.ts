import { formatINR } from '../../core/money';
import { decideClaim } from '../../policy/engine';
import { computeRiskSignals } from '../../policy/signals';
import type { ActionRequest } from '../../providers/types';
import type { Order } from '../../repositories';
import type { Handler, HandlerDeps, HandlerResult, TurnContext } from '../types';
import { assessImage } from '../image';
import { pickOrderId } from './util';

const CANCELLABLE = new Set(['placed', 'preparing']);

function detectIssue(text: string): string {
  if (/spill|spilt|leak|soaked/i.test(text)) return 'spillage';
  if (/missing|didn'?t (get|receive)|only (got|received)|received only|short/i.test(text)) return 'missing item';
  if (/wrong (order|item)|incorrect|not what i ordered/i.test(text)) return 'wrong item';
  if (/damaged|broken|crushed|smashed/i.test(text)) return 'damaged item';
  return 'order issue';
}

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

async function handleIssue(ctx: TurnContext, deps: HandlerDeps, order: Order): Promise<HandlerResult> {
  const issue = detectIssue(ctx.input.text);
  const amount = order.subtotal;
  let corroborated = order.status === 'delivered';
  let imageDuplicate = false;

  // If they sent a photo, score it and check it isn't reused from another ticket.
  if (ctx.input.image) {
    const assessment = await assessImage(deps.llm, ctx.conversation.id, ctx.input.image, ctx.input.text);
    deps.tracer.note('image', { duplicate: assessment.duplicate, issueType: assessment.score.issueType, severity: assessment.score.severity });
    imageDuplicate = assessment.duplicate;
    corroborated = corroborated && assessment.score.issueType !== 'none' && assessment.score.issueType !== 'unclear' && assessment.score.confidence >= 0.5;
  }

  const signals = await computeRiskSignals(order.customerId, deps.providers);

  const action: ActionRequest = {
    type: 'credit',
    amount,
    orderId: order.id,
    conversationId: ctx.conversation.id,
    customerId: order.customerId,
    reason: issue,
    idempotencyKey: `${ctx.conversation.id}:credit:${order.id}`,
  };
  const decision = await decideClaim({ action, signals, corroborated, imageDuplicate });
  deps.tracer.note('policy', { outcome: decision.outcome, reasons: decision.reasons });

  if (decision.outcome === 'auto_approve') {
    const res = await deps.providers.executor.execute(action);
    if (res.status === 'failed') return { reply: 'I hit a snag processing that — let me get a teammate on it.', status: 'escalated', escalationReason: res.message };
    const lead = res.status === 'duplicate' ? "I've already added that credit —" : `I'm sorry about the ${issue}. I've added ${formatINR(amount)} to your Swish balance right away —`;
    return { reply: `${lead} it's in your balance now. Anything else I can help with?`, status: 'resolved', action, data: { kind: 'resolution', issue, amount, outcome: 'auto_approve' } };
  }
  if (decision.outcome === 'deny') {
    return { reply: `Thanks for flagging the ${issue}. I can't process this one automatically, so I'm bringing in a teammate to take a closer look.`, status: 'escalated', escalationReason: decision.reasons.join('; '), data: { kind: 'resolution', issue, outcome: 'deny', reasons: decision.reasons } };
  }
  return { reply: `I'm really sorry about the ${issue}. I want to get this exactly right, so I'm looping in a teammate now — you won't have to repeat anything.`, status: 'escalated', escalationReason: decision.reasons.join('; '), data: { kind: 'resolution', issue, outcome: 'escalate', reasons: decision.reasons } };
}

export const orderActionHandler: Handler = {
  intents: ['order_issue', 'cancel_order'],
  async handle(ctx, deps) {
    const prefer = ctx.route.intent === 'cancel_order' ? 'active' : 'delivered';
    const orderId = ctx.orderId ?? (await pickOrderId(deps.providers, ctx.customerId, prefer));
    if (!orderId) return { reply: "Sure — which order is this about? Tap it from your orders list and I'll jump right in.", status: 'awaiting_user' };
    const order = await deps.providers.orders.getOrder(orderId);
    if (!order) return { reply: "I couldn't find that order — could you double-check it?", status: 'awaiting_user' };
    return ctx.route.intent === 'cancel_order' ? handleCancel(ctx, deps, order) : handleIssue(ctx, deps, order);
  },
};
