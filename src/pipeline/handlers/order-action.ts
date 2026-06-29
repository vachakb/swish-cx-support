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
import { orderChips } from './util';

const CANCELLABLE = new Set(['placed', 'preparing']);
// Yes/no parsing for the cancel confirmation step.
const CONFIRM = /\b(yes|yeah|yep|yup|confirm(ed)?|go ahead|do it|proceed|sure|ok(ay)?|please)\b|cancel it/i;
const DECLINE = /\b(no|nope|nah|don'?t|keep (it|my order)|leave it|never ?mind|nvm|stop|wait)\b/i;
// Food-safety claims (foreign object, contamination, illness) never auto-resolve — a human reviews them.
const SERIOUS = /\b(bug|insect|cockroach|roach|worm|maggot|hair|glass|plastic|metal|foreign|contaminat|mou?ld|rotten|spoil|expired|sick|ill|vomit|food pois|allerg)/i;
const MISSING = /\b(missing|didn'?t (get|receive)|only (got|received)|received only|short|incomplete|forgot|left out|not (in|included))\b/i;
type Remedy = ResolveDecision['remedy'];


async function executeCancel(ctx: TurnContext, deps: HandlerDeps, order: Order): Promise<HandlerResult> {
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


async function handleCancel(ctx: TurnContext, deps: HandlerDeps): Promise<HandlerResult> {
  const lastBot = [...ctx.history].reverse().find((m) => m.role === 'assistant');
  const pending = lastBot?.payload as { kind?: string; topic?: string; orderId?: string } | null | undefined;


  if (pending?.kind === 'clarify' && pending.topic === 'cancel_confirm' && pending.orderId) {
    if (DECLINE.test(ctx.input.text)) {
      return { reply: "No worries — I've left your order exactly as it is. Anything else I can help with?", status: 'awaiting_user', data: { kind: 'cancel', allowed: false } };
    }
    if (CONFIRM.test(ctx.input.text)) {
      const order = await deps.providers.orders.getOrder(pending.orderId);
      if (!order) return { reply: "I couldn't find that order anymore — could you double-check?", status: 'awaiting_user' };
      if (!CANCELLABLE.has(order.status)) return { reply: `That order's already ${order.status}, so there's nothing to cancel now.`, status: 'resolved', data: { kind: 'cancel', allowed: false } };
      return executeCancel(ctx, deps, order);
    }

    return { reply: 'Just so I get it right — should I go ahead and cancel it? (yes / no)', status: 'awaiting_user', suggestions: ['Yes, cancel it', 'No, keep it'], data: { kind: 'clarify', intent: 'cancel_order', topic: 'cancel_confirm', orderId: pending.orderId } };
  }


  if (!ctx.orderId) {
    const orders = ctx.customerId ? await deps.providers.orders.listOrdersByCustomer(ctx.customerId) : [];
    const cancellable = orders.filter((o) => CANCELLABLE.has(o.status));
    if (cancellable.length === 0) {
      return { reply: "I don't see an order that can still be cancelled — once we start cooking (within a minute or two) it's on its way. If something's wrong with one that's arriving or delivered, tell me and I'll make it right.", status: 'awaiting_user' };
    }
    const chips = await orderChips(deps.providers, cancellable, 'cancel this order');
    return { reply: 'Sure — which order would you like to cancel? Tap it below.', status: 'awaiting_user', suggestions: chips, data: { kind: 'clarify', intent: 'cancel_order', topic: 'cancel_pick' } };
  }


  const details = await deps.providers.orders.getOrderDetails(ctx.orderId);
  if (!details) return { reply: "I couldn't find that order — could you double-check it?", status: 'awaiting_user' };
  const { order, items } = details;
  if (!CANCELLABLE.has(order.status)) {
    return {
      reply: `That order's already ${order.status} — since we cook fresh and fast, I can't cancel it now. But if anything's off when it arrives, tell me and I'll fix it right away.`,
      status: 'resolved',
      data: { kind: 'cancel', allowed: false },
    };
  }
  const first = items[0];
  const label = first ? `your ${first.name}${items.length > 1 ? ` +${items.length - 1} more` : ''} order` : 'this order';
  return {
    reply: `Just to confirm — you'd like to cancel ${label} and get ${formatINR(order.total)} back to your original payment? I can't undo a cancellation once it's done.`,
    status: 'awaiting_user',
    suggestions: ['Yes, cancel it', 'No, keep it'],
    data: { kind: 'clarify', intent: 'cancel_order', topic: 'cancel_confirm', orderId: order.id },
  };
}


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


  let image: VisionScore | undefined;
  let imageDuplicate = false;
  if (ctx.input.image) {
    const assessment = await assessImage(deps.llm, ctx.conversation.id, ctx.input.image, ctx.input.text);
    deps.tracer.note('image', { duplicate: assessment.duplicate, issueType: assessment.score.issueType, severity: assessment.score.severity });
    image = assessment.score;
    imageDuplicate = assessment.duplicate;
  }


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


  if (!decision.needMoreInfo && decision.remedy === 'escalate') {
    return { reply: decision.reply, status: 'escalated', escalationReason: decision.diagnosis || 'needs a teammate', polish: false, suggestions: decision.suggestions, data: { kind: 'resolution', diagnosis: decision.diagnosis, outcome: 'escalate' } };
  }


  const acting = !decision.needMoreInfo && decision.remedy !== 'none' && (decision.remedy === 'redeliver' || decision.amountPaise > 0);
  if (!acting) {
    return { reply: decision.reply, status: 'awaiting_user', polish: false, suggestions: decision.suggestions, data: { kind: 'clarify', diagnosis: decision.diagnosis } };
  }


  if (SERIOUS.test(ctx.input.text) || SERIOUS.test(decision.diagnosis)) {
    return {
      reply: "I'm really sorry — a possible food-safety issue like this is something I want our team to review properly and fast. I've flagged it with all the details (a photo helps if you have one), and a teammate will be straight in touch to make it right.",
      status: 'escalated',
      escalationReason: `possible food-safety issue ("${decision.diagnosis}") — manual review`,
      polish: false,
      data: { kind: 'resolution', diagnosis: decision.diagnosis, outcome: 'manual_review' },
    };
  }


  if (decision.remedy === 'credit' || decision.remedy === 'refund') {
    if (MISSING.test(ctx.input.text) || MISSING.test(decision.diagnosis)) {
      return {
        reply: "I'm sorry an item was missing! Let me check with the kitchen team to confirm what was packed for your order — I'll make this right as soon as I hear back from them.",
        status: 'escalated',
        escalationReason: `missing-item claim ("${decision.diagnosis}") — kitchen verification`,
        polish: false,
        data: { kind: 'resolution', diagnosis: decision.diagnosis, outcome: 'kitchen_check' },
      };
    }
    if (!image) {
      return {
        reply: "I want to make this right! To put a credit or refund through I'll just need a quick photo of the issue — could you share one? (If you can't, I'll have a teammate verify it and sort it for you.)",
        status: 'awaiting_user',
        polish: false,
        data: { kind: 'clarify', diagnosis: decision.diagnosis },
      };
    }
  }


  const action = toAction(decision.remedy, decision.amountPaise, decision.reason, order, ctx);
  if (!action) return { reply: decision.reply, status: 'awaiting_user', polish: false, data: { kind: 'clarify' } };
  const corroborated = order.status === 'delivered' && (!image || (image.issueType !== 'none' && image.issueType !== 'unclear' && image.confidence >= 0.5));
  const signals = await computeRiskSignals(order.customerId, deps.providers);
  const policy = await decideClaim({ action, signals, corroborated, imageDuplicate });
  deps.tracer.note('policy', { outcome: policy.outcome, reasons: policy.reasons });

  if (policy.outcome === 'auto_approve') {
    const amount = 'amount' in action ? action.amount : 0;

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
    if (ctx.route.intent === 'cancel_order') return handleCancel(ctx, deps);

    if (!ctx.orderId) {
      const orders = ctx.customerId ? await deps.providers.orders.listOrdersByCustomer(ctx.customerId) : [];
      const relevant = orders.filter((o) => o.status !== 'cancelled');
      if (relevant.length === 0) return { reply: "I'm sorry something's not right! I don't see a recent order on your account — could you tell me a bit more about what happened?", status: 'awaiting_user' };
      const chips = await orderChips(deps.providers, relevant.slice(0, 5), "it's about this order");
      return { reply: "I'm sorry to hear that! Which order is this about?", status: 'awaiting_user', suggestions: chips, data: { kind: 'clarify', intent: 'order_issue', topic: 'issue_pick' } };
    }
    const details = await deps.providers.orders.getOrderDetails(ctx.orderId);
    if (!details) return { reply: "I couldn't find that order — could you double-check it?", status: 'awaiting_user' };
    return handleIssue(ctx, deps, details.order, details.items);
  },
};
