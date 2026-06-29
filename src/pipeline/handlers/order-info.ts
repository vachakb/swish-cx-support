import { assessEta } from '../../eta/truth';
import { composeWismo } from '../wismo';
import type { Handler } from '../types';
import { pickOrderId } from './util';

export const orderInfoHandler: Handler = {
  intents: ['order_status'],
  async handle(ctx, deps) {
    const orderId = ctx.orderId ?? (await pickOrderId(deps.providers, ctx.customerId, 'delivering'));
    if (!orderId) return { reply: "Happy to check — which order? Tap it from your orders and I'll pull up the live status.", status: 'awaiting_user' };

    const details = await deps.providers.orders.getOrderDetails(orderId);
    if (!details) return { reply: "I couldn't find that order — could you double-check it?", status: 'awaiting_user' };

    const { order, tracking } = details;
    if (order.status === 'delivered') return { reply: "That order's marked delivered. If something's not right with it, tell me what happened and I'll sort it out.", status: 'resolved', data: { kind: 'order_status', status: 'delivered' } };
    if (order.status === 'cancelled') return { reply: 'That order was cancelled. Want me to help place a fresh one?', status: 'resolved', data: { kind: 'order_status', status: 'cancelled' } };
    if (order.status === 'placed' || order.status === 'preparing' || !tracking) {
      return {
        reply: `Your order is ${order.status === 'preparing' ? 'being prepared in our kitchen' : 'confirmed and being lined up'} — I'll have a live, minute-by-minute ETA the moment a rider picks it up. 🍳`,
        status: 'resolved',
        data: { kind: 'order_status', status: order.status },
      };
    }

    const truth = assessEta({
      etaSeconds: tracking.etaSeconds,
      etaLastComputedAt: tracking.etaLastComputedAt,
      riderLastGpsAt: tracking.riderLastGpsAt,
      distanceRemainingM: tracking.distanceRemainingM ?? null,
      promisedBy: order.promisedBy,
      now: Date.now(),
    });
    deps.tracer.note('eta_truth', { confidence: truth.confidence, recommendation: truth.recommendation, isStuck: truth.isStuck, freshEtaSeconds: truth.freshEtaSeconds, reasons: truth.reasons });

    const freshMin = truth.displayEtaSeconds != null ? Math.max(1, Math.round(truth.displayEtaSeconds / 60)) : null;


    if (truth.recommendation === 'show_eta' && freshMin != null) {
      return { reply: `Your order's on its way — about ${freshMin} min away 🛵 I'll keep an eye on it!`, status: 'resolved', data: { kind: 'eta', truth } };
    }


    const wismo = await composeWismo({
      llm: deps.llm,
      message: ctx.input.text,
      history: ctx.history.slice(0, -1),
      facts: {
        status: order.status,
        reliable: truth.recommendation !== 'investigate' && freshMin != null,
        freshEtaMinutes: freshMin,
        minutesLate: truth.minutesLate,
        riderDistanceKm: tracking.distanceRemainingM != null ? Math.round(tracking.distanceRemainingM / 100) / 10 : null,
        gpsMinutesAgo: tracking.riderLastGpsAt ? Math.round((Date.now() - tracking.riderLastGpsAt.getTime()) / 60_000) : null,
        severe: truth.confidence === 'low' && truth.minutesLate >= 5,
      },
    });
    deps.tracer.note('wismo', { escalate: wismo.escalate });
    return {
      reply: wismo.reply,
      status: wismo.escalate ? 'escalated' : 'resolved',
      escalationReason: wismo.escalate ? `order ${truth.minutesLate} min late with unreliable tracking` : undefined,
      polish: false,
      data: { kind: 'eta', truth },
    };
  },
};
