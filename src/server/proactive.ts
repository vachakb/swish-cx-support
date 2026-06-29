import { assessEta } from '../eta/truth';
import { publishCustomerEvent, publishMessage } from '../notifications/bus';
import * as repo from '../repositories';
import type { Order } from '../repositories';

// Check for late/stuck orders this often. The best support ticket is the one never filed: we reach out
// before the customer has to ask. Honest status only — this never moves money.
const PROACTIVE_INTERVAL_MS = 90 * 1000;

function composeProactive(truth: ReturnType<typeof assessEta>): string {
  if (truth.recommendation === 'investigate') {
    return "Quick heads-up on your Swish order 👋 — it's running behind and the live ETA isn't updating, so I'm checking with the rider and kitchen to get it moving. You can track it live in the app, and I'll let you know here the moment it's on its way.";
  }
  const min = truth.displayEtaSeconds != null ? Math.max(1, Math.round(truth.displayEtaSeconds / 60)) : null;
  return `Quick heads-up on your Swish order 👋 — it's running a little behind${min != null ? `, now about ${min} min away` : ''}. I'm keeping a close eye on it, and you can track it live in the app. Sorry for the wait!`;
}

async function findOrCreateConversation(order: Order) {
  const convs = await repo.listConversationsByCustomer(order.customerId);
  const open = convs.find((c) => c.orderId === order.id && c.status !== 'closed');
  return open ?? repo.createConversation({ customerId: order.customerId, orderId: order.id, channel: 'web', status: 'bot', subject: 'Your order update' });
}

export async function sweepLateOrders(now = Date.now()): Promise<number> {
  const orders = await repo.listInTransitOrders();
  let reached = 0;
  for (const order of orders) {
    const tracking = await repo.getTracking(order.id);
    if (!tracking) continue;
    const truth = assessEta({
      etaSeconds: tracking.etaSeconds,
      etaLastComputedAt: tracking.etaLastComputedAt,
      riderLastGpsAt: tracking.riderLastGpsAt,
      distanceRemainingM: tracking.distanceRemainingM ?? null,
      promisedBy: order.promisedBy,
      now,
    });
    if (truth.recommendation === 'show_eta') continue; // on track — nothing to flag
    const conv = await findOrCreateConversation(order);
    const msgs = await repo.listMessages(conv.id);
    if (msgs.some((m) => (m.payload as { kind?: string } | null)?.kind === 'proactive_eta')) continue; // already nudged once
    const text = composeProactive(truth);
    const msg = await repo.addMessage({ conversationId: conv.id, role: 'assistant', text, payload: { kind: 'proactive_eta', orderId: order.id } });
    publishMessage(conv.id, msg); // → an open chat on this conversation
    publishCustomerEvent(order.customerId, { conversationId: conv.id, kind: 'proactive_eta', text }); // → a notification anywhere in the app
    reached++;
  }
  return reached;
}

export function startProactiveOutreach(intervalMs = PROACTIVE_INTERVAL_MS): () => void {
  const timer = setInterval(() => {
    void sweepLateOrders().catch(() => {}); // a sweep error must never crash the loop
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
