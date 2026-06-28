import { db } from './client';
import {
  attachments,
  auditLog,
  conversations,
  customers,
  messages,
  orderItems,
  orderTracking,
  orders,
  resolutions,
  scenarios,
  serviceability,
  traces,
  wallets,
} from './schema';

// Stable, readable ids so scenarios/orders link predictably and re-seeding is deterministic.
const NOW = Date.now();
const mins = (n: number) => new Date(NOW - n * 60_000);
const secs = (n: number) => new Date(NOW - n * 1_000);
const days = (n: number) => new Date(NOW - n * 86_400_000);
const plusMins = (d: Date, n: number) => new Date(d.getTime() + n * 60_000);
const inMins = (n: number) => new Date(NOW + n * 60_000);

async function clear() {
  // Delete in child→parent order (FK-safe even if enforcement is on).
  for (const t of [traces, auditLog, resolutions, attachments, messages, scenarios, conversations, orderTracking, orderItems, orders, serviceability, wallets, customers]) {
    await db.delete(t);
  }
}

async function seed() {
  await clear();

  await db.insert(customers).values([
    { id: 'cust_arjun', name: 'Arjun Mehta', phone: '+919000011111', email: 'arjun@example.com', city: 'Bengaluru', area: 'HSR Layout', accountAgeDays: 420 },
    { id: 'cust_priya', name: 'Priya Nair', phone: '+919000022222', email: 'priya@example.com', city: 'Bengaluru', area: 'Koramangala', accountAgeDays: 210 },
    { id: 'cust_rahul', name: 'Rahul Verma', phone: '+919000033333', email: 'rahul@example.com', city: 'Bengaluru', area: 'Indiranagar', accountAgeDays: 11 },
    { id: 'cust_neha', name: 'Neha Shah', phone: '+919000044444', email: 'neha@example.com', city: 'Bengaluru', area: 'HSR Layout', accountAgeDays: 95 },
  ]);

  // Amounts in paise. referralRewardPending drives the "where's my referral reward?" hybrid.
  await db.insert(wallets).values([
    { customerId: 'cust_arjun', creditBalance: 0, referralCode: 'ARJUN150', referralsCompleted: 3, referralRewardEarned: 15000, referralRewardPending: 5000 },
    { customerId: 'cust_priya', creditBalance: 5000, referralCode: 'PRIYA150', referralsCompleted: 1, referralRewardEarned: 5000, referralRewardPending: 0 },
    { customerId: 'cust_rahul', creditBalance: 0, referralCode: 'RAHUL150', referralsCompleted: 0, referralRewardEarned: 0, referralRewardPending: 0 },
    { customerId: 'cust_neha', creditBalance: 0, referralCode: 'NEHA150', referralsCompleted: 1, referralRewardEarned: 0, referralRewardPending: 5000 },
  ]);

  await db.insert(serviceability).values([
    { id: 'svc_hsr', city: 'Bengaluru', area: 'HSR Layout', serviceable: true },
    { id: 'svc_kor', city: 'Bengaluru', area: 'Koramangala', serviceable: true },
    { id: 'svc_ind', city: 'Bengaluru', area: 'Indiranagar', serviceable: true },
    { id: 'svc_bel', city: 'Bengaluru', area: 'Bellandur', serviceable: true },
    { id: 'svc_whf', city: 'Bengaluru', area: 'Whitefield', serviceable: true },
    { id: 'svc_jay', city: 'Bengaluru', area: 'Jayanagar', serviceable: false, note: 'launching soon' },
    { id: 'svc_ecity', city: 'Bengaluru', area: 'Electronic City', serviceable: false, note: 'not live yet' },
    { id: 'svc_mum', city: 'Mumbai', area: 'Bandra', serviceable: false, note: 'coming soon' },
    { id: 'svc_del', city: 'Delhi', area: 'Saket', serviceable: false, note: 'not live yet' },
  ]);

  const stuckPlaced = mins(22);
  const healthyPlaced = mins(4);
  const spillPlaced = days(2);
  const missingPlaced = mins(30);
  const wrongPlaced = mins(40);
  const cancelPlaced = mins(1);

  await db.insert(orders).values([
    // Stuck-ETA demo: placed 22m ago, promise breached 12m ago, still "arriving".
    { id: 'ord_stuck', customerId: 'cust_arjun', status: 'arriving', placedAt: stuckPlaced, promisedBy: plusMins(stuckPlaced, 10), podId: 'pod_hsr_01', riderId: 'rider_07', addressArea: 'HSR Layout', subtotal: 26000, total: 26000, paymentMethod: 'upi' },
    // Healthy in-progress: fresh GPS, before promise.
    { id: 'ord_healthy', customerId: 'cust_priya', status: 'dispatched', placedAt: healthyPlaced, promisedBy: inMins(6), podId: 'pod_kor_01', riderId: 'rider_12', addressArea: 'Koramangala', subtotal: 22000, total: 22000, paymentMethod: 'upi' },
    { id: 'ord_spill', customerId: 'cust_arjun', status: 'delivered', placedAt: spillPlaced, promisedBy: plusMins(spillPlaced, 10), deliveredAt: plusMins(spillPlaced, 11), podId: 'pod_hsr_01', riderId: 'rider_03', addressArea: 'HSR Layout', subtotal: 12000, total: 12000, paymentMethod: 'upi' },
    { id: 'ord_missing', customerId: 'cust_priya', status: 'delivered', placedAt: missingPlaced, promisedBy: plusMins(missingPlaced, 10), deliveredAt: mins(18), podId: 'pod_kor_01', riderId: 'rider_09', addressArea: 'Koramangala', subtotal: 22000, total: 22000, paymentMethod: 'upi' },
    { id: 'ord_wrong', customerId: 'cust_rahul', status: 'delivered', placedAt: wrongPlaced, promisedBy: plusMins(wrongPlaced, 10), deliveredAt: mins(28), podId: 'pod_ind_01', riderId: 'rider_15', addressArea: 'Indiranagar', subtotal: 28000, total: 28000, paymentMethod: 'upi' },
    { id: 'ord_cancel', customerId: 'cust_arjun', status: 'placed', placedAt: cancelPlaced, promisedBy: inMins(9), podId: 'pod_hsr_01', addressArea: 'HSR Layout', subtotal: 4000, total: 4000, paymentMethod: 'upi' },
  ]);

  await db.insert(orderItems).values([
    { id: 'oit_stuck_1', orderId: 'ord_stuck', name: 'Masala Chai', quantity: 2, unitPrice: 4000 },
    { id: 'oit_stuck_2', orderId: 'ord_stuck', name: 'Veg Biryani', quantity: 1, unitPrice: 18000 },
    { id: 'oit_healthy_1', orderId: 'ord_healthy', name: 'Paneer Roll', quantity: 2, unitPrice: 9000 },
    { id: 'oit_healthy_2', orderId: 'ord_healthy', name: 'Coke', quantity: 1, unitPrice: 4000 },
    { id: 'oit_spill_1', orderId: 'ord_spill', name: 'Masala Chai', quantity: 2, unitPrice: 4000 },
    { id: 'oit_spill_2', orderId: 'ord_spill', name: 'Filter Coffee', quantity: 1, unitPrice: 4000 },
    { id: 'oit_missing_1', orderId: 'ord_missing', name: 'Paneer Roll', quantity: 2, unitPrice: 9000 },
    { id: 'oit_missing_2', orderId: 'ord_missing', name: 'Coke', quantity: 1, unitPrice: 4000 },
    { id: 'oit_wrong_1', orderId: 'ord_wrong', name: 'Chicken Biryani', quantity: 1, unitPrice: 24000 },
    { id: 'oit_wrong_2', orderId: 'ord_wrong', name: 'Raita', quantity: 1, unitPrice: 4000 },
    { id: 'oit_cancel_1', orderId: 'ord_cancel', name: 'Masala Chai', quantity: 1, unitPrice: 4000 },
  ]);

  await db.insert(orderTracking).values([
    // Stale + stuck + breached: ETA frozen at 3 min, GPS dead 20 min, no state change.
    { orderId: 'ord_stuck', etaSeconds: 180, etaLastComputedAt: mins(20), riderLat: 12.911, riderLng: 77.638, riderLastGpsAt: mins(20), distanceRemainingM: 1200, stage: 'enroute', stateLastTransitionAt: mins(20) },
    // Fresh and healthy.
    { orderId: 'ord_healthy', etaSeconds: 300, etaLastComputedAt: secs(15), riderLat: 12.935, riderLng: 77.624, riderLastGpsAt: secs(8), distanceRemainingM: 900, stage: 'enroute', stateLastTransitionAt: secs(90) },
  ]);

  // Rahul's resolved history → high refund velocity (fraud signal). Plus one escalated thread for the inbox.
  await db.insert(conversations).values([
    { id: 'cnv_rahul_1', customerId: 'cust_rahul', channel: 'web', status: 'resolved', subject: 'Spillage refund', sentiment: 'neutral', createdAt: days(1) },
    { id: 'cnv_rahul_2', customerId: 'cust_rahul', channel: 'web', status: 'resolved', subject: 'Missing item', sentiment: 'neutral', createdAt: days(3) },
    { id: 'cnv_rahul_3', customerId: 'cust_rahul', channel: 'web', status: 'resolved', subject: 'Wrong order', sentiment: 'negative', createdAt: days(5) },
    { id: 'cnv_escalated', customerId: 'cust_neha', channel: 'whatsapp', status: 'escalated', subject: 'Charged twice for one order', sentiment: 'angry', escalationReason: 'payment dispute outside auto-resolve policy', createdAt: mins(6) },
  ]);

  await db.insert(messages).values([
    { id: 'msg_esc_1', conversationId: 'cnv_escalated', role: 'user', text: 'I was charged twice for the same order and no one is helping!' },
    { id: 'msg_esc_2', conversationId: 'cnv_escalated', role: 'assistant', text: "I'm really sorry, Neha. A double charge needs a teammate to verify the payment — I've escalated this with all your details so you won't have to repeat anything." },
  ]);

  await db.insert(resolutions).values([
    { id: 'res_r1', conversationId: 'cnv_rahul_1', customerId: 'cust_rahul', type: 'refund', amount: 18000, reason: 'spillage', decidedBy: 'bot', status: 'executed', idempotencyKey: 'seed-r1', createdAt: days(1) },
    { id: 'res_r2', conversationId: 'cnv_rahul_2', customerId: 'cust_rahul', type: 'credit', amount: 12000, reason: 'missing item', decidedBy: 'bot', status: 'executed', idempotencyKey: 'seed-r2', createdAt: days(3) },
    { id: 'res_r3', conversationId: 'cnv_rahul_3', customerId: 'cust_rahul', type: 'refund', amount: 26000, reason: 'wrong order', decidedBy: 'human', status: 'executed', idempotencyKey: 'seed-r3', createdAt: days(5) },
  ]);

  await db.insert(scenarios).values([
    { id: 'scn_stuck', title: 'Late order, tracking stuck at 3 min', description: 'Order is 22 min in, promise breached, GPS dead — the classic frozen ETA. Watch ETA Truth catch it instead of parroting "3 mins".', customerId: 'cust_arjun', orderId: 'ord_stuck', channel: 'web', suggestedMessage: "where is my order?? it's been 20 minutes and still says 3 min", tags: ['eta', 'wismo', 'flagship'] },
    { id: 'scn_healthy', title: 'Normal "where is my order?"', description: 'A healthy in-progress order with fresh tracking — the honest happy path.', customerId: 'cust_priya', orderId: 'ord_healthy', channel: 'web', suggestedMessage: "where's my order?", tags: ['eta', 'wismo'] },
    { id: 'scn_spill', title: 'Spillage with photo', description: 'Delivered order, customer reports a spill and can attach a photo → image + policy → refund/credit.', customerId: 'cust_arjun', orderId: 'ord_spill', channel: 'web', suggestedMessage: 'my chai spilled all over, the bag was soaked', tags: ['order-action', 'spillage', 'image'] },
    { id: 'scn_missing', title: 'Missing item', description: 'Customer got fewer items than ordered → corroborate against order → credit.', customerId: 'cust_priya', orderId: 'ord_missing', channel: 'web', suggestedMessage: 'I ordered 2 paneer rolls but only got 1', tags: ['order-action', 'missing'] },
    { id: 'scn_wrong_fraud', title: 'Wrong order (repeat claimant)', description: 'Wrong-order claim from a new account with 3 recent refunds → fraud velocity trips → friction/escalate.', customerId: 'cust_rahul', orderId: 'ord_wrong', channel: 'web', suggestedMessage: 'this is the wrong order, I want a full refund', tags: ['order-action', 'wrong', 'fraud'] },
    { id: 'scn_cancel', title: 'Cancel a just-placed order', description: 'Order still in "placed" (not cooked yet) → cancellable with refund. Contrast with a dispatched order.', customerId: 'cust_arjun', orderId: 'ord_cancel', channel: 'web', suggestedMessage: 'cancel my order please', tags: ['cancel'] },
    { id: 'scn_referral', title: "Where's my referral reward?", description: 'FAQ-looking but actually a live data query — needs the wallet pending balance.', customerId: 'cust_neha', channel: 'web', suggestedMessage: 'I referred my friend, where is my ₹50 reward?', tags: ['faq', 'referral', 'hybrid'] },
    { id: 'scn_serviceable', title: 'Are you in my area?', description: 'Serviceability FAQ — Indiranagar is live.', customerId: 'cust_priya', channel: 'web', suggestedMessage: 'do you deliver to Indiranagar?', tags: ['faq', 'serviceability'] },
    { id: 'scn_not_serviceable', title: 'Area says not serviceable', description: 'Edge case: area is generally live but customer hits a not-serviceable message → graceful handling.', customerId: 'cust_neha', channel: 'web', suggestedMessage: "I'm in HSR but the app says you don't deliver here", tags: ['faq', 'serviceability', 'edge'] },
  ]);
}

await seed();

const counts = {
  customers: (await db.select().from(customers)).length,
  orders: (await db.select().from(orders)).length,
  scenarios: (await db.select().from(scenarios)).length,
  resolutions: (await db.select().from(resolutions)).length,
};
console.log('Seeded:', counts);
