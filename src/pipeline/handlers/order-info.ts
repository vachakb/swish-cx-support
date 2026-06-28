import { formatINR } from '../../core/money';
import { assessEta } from '../../eta/truth';
import { etaConfig } from '../../eta/config';
import { decideClaim } from '../../policy/engine';
import { computeRiskSignals } from '../../policy/signals';
import type { ActionRequest } from '../../providers/types';
import type { Handler, HandlerDeps, HandlerResult } from '../types';
import { pickOrderId } from './util';
import type { Order } from '../../repositories';

// On a severe, stuck delay we proactively compensate (goodwill credit, idempotent + policy-gated)
// rather than make the customer chase us.
async function proactiveGoodwill(conversationId: string, deps: HandlerDeps, order: Order): Promise<{ creditedPaise: number; action?: ActionRequest }> {
  const action: ActionRequest = {
    type: 'credit',
    amount: etaConfig.delayGoodwillPaise,
    orderId: order.id,
    conversationId,
    customerId: order.customerId,
    reason: 'delay goodwill',
    idempotencyKey: `${conversationId}:goodwill:${order.id}`,
  };
  const signals = await computeRiskSignals(order.customerId, deps.providers);
  const decision = await decideClaim({ action, signals, corroborated: true, imageDuplicate: false });
  if (decision.outcome !== 'auto_approve') return { creditedPaise: 0 };
  const res = await deps.providers.executor.execute(action);
  return res.status === 'failed' ? { creditedPaise: 0 } : { creditedPaise: etaConfig.delayGoodwillPaise, action };
}

export const orderInfoHandler: Handler = {
  intents: ['order_status'],
  async handle(ctx, deps) {
    const orderId = ctx.orderId ?? (await pickOrderId(deps.providers, ctx.customerId, 'active'));
    if (!orderId) return { reply: "Happy to check — which order? Tap it from your orders and I'll pull up the live status.", status: 'awaiting_user' };

    const details = await deps.providers.orders.getOrderDetails(orderId);
    if (!details) return { reply: "I couldn't find that order — could you double-check it?", status: 'awaiting_user' };

    const { order, tracking } = details;
    if (order.status === 'delivered') return { reply: "That order's marked delivered. If something's not right with it, tell me what happened and I'll sort it out.", status: 'resolved', data: { kind: 'order_status', status: 'delivered' } };
    if (order.status === 'cancelled') return { reply: 'That order was cancelled. Want me to help place a fresh one?', status: 'resolved', data: { kind: 'order_status', status: 'cancelled' } };
    if (!tracking) return { reply: `Your order is ${order.status} — I'll have a live ETA the moment a rider's assigned.`, status: 'resolved', data: { kind: 'order_status', status: order.status } };

    const truth = assessEta({
      etaSeconds: tracking.etaSeconds,
      etaLastComputedAt: tracking.etaLastComputedAt,
      riderLastGpsAt: tracking.riderLastGpsAt,
      promisedBy: order.promisedBy,
      now: Date.now(),
    });
    deps.tracer.note('eta_truth', { confidence: truth.confidence, recommendation: truth.recommendation, isStuck: truth.isStuck, reasons: truth.reasons });

    if (truth.recommendation === 'show_eta') {
      const mins = Math.max(1, Math.round((truth.displayEtaSeconds ?? tracking.etaSeconds) / 60));
      return { reply: `Your order's on the way — about ${mins} min out. I'll keep an eye on it!`, status: 'resolved', data: { kind: 'eta', truth, etaSeconds: truth.displayEtaSeconds } };
    }

    if (truth.recommendation === 'acknowledge_delay') {
      const lead = truth.isBreached
        ? `It's running a little behind our promise${truth.minutesLate ? ` (about ${truth.minutesLate} min over)` : ''} — sorry about that.`
        : "Tracking's catching up on this one,";
      return { reply: `${lead} Your order's still on its way and I'm watching it closely. Want me to nudge the rider?`, status: 'resolved', data: { kind: 'eta', truth } };
    }

    // proactive_remedy: don't parrot the stale number — be honest, compensate, and escalate.
    const { creditedPaise, action } = await proactiveGoodwill(ctx.conversation.id, deps, order);
    const creditLine = creditedPaise > 0 ? ` I've added ${formatINR(creditedPaise)} to your Swish balance for the wait.` : '';
    return {
      reply: `I'm really sorry — your order is running well past our 10-minute promise and I'm not getting a reliable live update from the rider right now.${creditLine} I'm escalating this to our team so we can get it to you fast.`,
      status: 'escalated',
      escalationReason: 'order severely delayed and tracking is stale',
      action,
      data: { kind: 'eta', truth, goodwillPaise: creditedPaise },
    };
  },
};
