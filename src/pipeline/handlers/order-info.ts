import type { Handler } from '../types';
import { pickOrderId } from './util';

// Basic ETA reply. NOTE: this reads tracking.etaSeconds directly — the naive behaviour that the
// ETA Truth module (task 5) replaces, so it'll happily say "3 min" on a stuck order. Kept as the baseline.
export const orderInfoHandler: Handler = {
  intents: ['order_status'],
  async handle(ctx, deps) {
    const orderId = ctx.orderId ?? (await pickOrderId(deps.providers, ctx.customerId, 'active'));
    if (!orderId) return { reply: "Happy to check — which order? Tap it from your orders and I'll pull up the live status.", status: 'awaiting_user' };

    const details = await deps.providers.orders.getOrderDetails(orderId);
    if (!details) return { reply: "I couldn't find that order — could you double-check it?", status: 'awaiting_user' };

    const { order, tracking } = details;
    if (order.status === 'delivered') {
      return { reply: "That order's marked delivered. If something's not right with it, tell me what happened and I'll sort it out.", status: 'resolved', data: { kind: 'order_status', status: 'delivered' } };
    }
    if (order.status === 'cancelled') {
      return { reply: 'That order was cancelled. Want me to help place a fresh one?', status: 'resolved', data: { kind: 'order_status', status: 'cancelled' } };
    }
    if (!tracking) {
      return { reply: `Your order is ${order.status} — I'll have a live ETA the moment a rider's assigned.`, status: 'resolved', data: { kind: 'order_status', status: order.status } };
    }
    const mins = Math.max(1, Math.round(tracking.etaSeconds / 60));
    return { reply: `Your order is ${order.status} — about ${mins} min away.`, status: 'resolved', data: { kind: 'eta', etaSeconds: tracking.etaSeconds, stage: tracking.stage } };
  },
};
