import {
  attachments,
  auditLog,
  conversations,
  customers,
  faqArticles,
  faqCategories,
  messages,
  orderItems,
  orderTracking,
  orders,
  resolutions,
  serviceability,
  traces,
  wallets,
} from './schema';
import { db } from './client';
import { faqSeed } from '../faq/content';

// One demo customer with a spread of orders + a little history, so the Help screen has real content.
const CUSTOMER = 'cust_arjun';

const NOW = Date.now();
const mins = (n: number) => new Date(NOW - n * 60_000);
const secs = (n: number) => new Date(NOW - n * 1_000);
const hrs = (n: number) => new Date(NOW - n * 3_600_000);
const days = (n: number) => new Date(NOW - n * 86_400_000);
const plusMins = (d: Date, n: number) => new Date(d.getTime() + n * 60_000);
const inMins = (n: number) => new Date(NOW + n * 60_000);

async function clear() {
  for (const t of [traces, auditLog, resolutions, attachments, messages, conversations, orderTracking, orderItems, orders, serviceability, wallets, customers, faqArticles, faqCategories]) {
    await db.delete(t);
  }
}

async function seed() {
  await clear();

  await db.insert(customers).values([{ id: CUSTOMER, name: 'Arjun Mehta', phone: '+919000011111', email: 'arjun@example.com', city: 'Bengaluru', area: 'HSR Layout', accountAgeDays: 420 }]);

  await db.insert(wallets).values([{ customerId: CUSTOMER, creditBalance: 3000, referralCode: 'ARJUN150', referralsCompleted: 3, referralRewardEarned: 15000, referralRewardPending: 5000 }]);

  await db.insert(serviceability).values([
    { id: 'svc_hsr', city: 'Bengaluru', area: 'HSR Layout', serviceable: true },
    { id: 'svc_kor', city: 'Bengaluru', area: 'Koramangala', serviceable: true },
    { id: 'svc_ind', city: 'Bengaluru', area: 'Indiranagar', serviceable: true },
    { id: 'svc_jay', city: 'Bengaluru', area: 'Jayanagar', serviceable: false, note: 'launching soon' },
    { id: 'svc_mum', city: 'Mumbai', area: 'Bandra', serviceable: false, note: 'coming soon' },
  ]);

  const stuckPlaced = mins(22);
  const activePlaced = mins(4);
  const cancelPlaced = mins(1);

  await db.insert(orders).values([
    { id: 'ord_stuck', customerId: CUSTOMER, status: 'arriving', placedAt: stuckPlaced, promisedBy: plusMins(stuckPlaced, 10), podId: 'pod_hsr_01', riderId: 'rider_07', addressArea: 'HSR Layout', subtotal: 26000, total: 26000, paymentMethod: 'upi' },
    { id: 'ord_active', customerId: CUSTOMER, status: 'dispatched', placedAt: activePlaced, promisedBy: inMins(6), podId: 'pod_hsr_01', riderId: 'rider_12', addressArea: 'HSR Layout', subtotal: 22000, total: 22000, paymentMethod: 'upi' },
    { id: 'ord_del_1', customerId: CUSTOMER, status: 'delivered', placedAt: hrs(2), promisedBy: plusMins(hrs(2), 10), deliveredAt: plusMins(hrs(2), 9), podId: 'pod_hsr_01', riderId: 'rider_03', addressArea: 'HSR Layout', subtotal: 39600, total: 39600, paymentMethod: 'upi' },
    { id: 'ord_del_2', customerId: CUSTOMER, status: 'delivered', placedAt: days(1), promisedBy: plusMins(days(1), 10), deliveredAt: plusMins(days(1), 8), podId: 'pod_hsr_01', riderId: 'rider_09', addressArea: 'HSR Layout', subtotal: 19800, total: 19800, paymentMethod: 'upi' },
    { id: 'ord_del_3', customerId: CUSTOMER, status: 'delivered', placedAt: days(4), promisedBy: plusMins(days(4), 10), deliveredAt: plusMins(days(4), 11), podId: 'pod_hsr_01', riderId: 'rider_15', addressArea: 'HSR Layout', subtotal: 39700, total: 39700, paymentMethod: 'upi' },
    { id: 'ord_cancel', customerId: CUSTOMER, status: 'placed', placedAt: cancelPlaced, promisedBy: inMins(9), podId: 'pod_hsr_01', addressArea: 'HSR Layout', subtotal: 8000, total: 8000, paymentMethod: 'upi' },
  ]);

  await db.insert(orderItems).values([
    { id: 'oit_stuck_1', orderId: 'ord_stuck', name: 'Masala Chai', quantity: 2, unitPrice: 4000 },
    { id: 'oit_stuck_2', orderId: 'ord_stuck', name: 'Veg Biryani', quantity: 1, unitPrice: 18000 },
    { id: 'oit_active_1', orderId: 'ord_active', name: 'Paneer Roll', quantity: 2, unitPrice: 9000 },
    { id: 'oit_active_2', orderId: 'ord_active', name: 'Spiced Buttermilk', quantity: 1, unitPrice: 4000 },
    { id: 'oit_del1_1', orderId: 'ord_del_1', name: 'Strawberry and Dark Chocolate Jar', quantity: 1, unitPrice: 19600 },
    { id: 'oit_del1_2', orderId: 'ord_del_1', name: 'Egg Bhurji Pav', quantity: 1, unitPrice: 16000 },
    { id: 'oit_del1_3', orderId: 'ord_del_1', name: 'Spiced Buttermilk', quantity: 1, unitPrice: 4000 },
    { id: 'oit_del2_1', orderId: 'ord_del_2', name: 'Egg Bhurji Sandwich', quantity: 1, unitPrice: 19800 },
    { id: 'oit_del3_1', orderId: 'ord_del_3', name: 'Chocolate Overnight Soaked Oats', quantity: 1, unitPrice: 19700 },
    { id: 'oit_del3_2', orderId: 'ord_del_3', name: 'Filter Coffee', quantity: 1, unitPrice: 20000 },
    { id: 'oit_cancel_1', orderId: 'ord_cancel', name: 'Masala Chai', quantity: 2, unitPrice: 4000 },
  ]);

  await db.insert(orderTracking).values([
    // Stuck: ETA frozen at 3 min, computed + GPS 20 min ago, promise breached 12 min ago.
    { orderId: 'ord_stuck', etaSeconds: 180, etaLastComputedAt: mins(20), riderLat: 12.911, riderLng: 77.638, riderLastGpsAt: mins(20), distanceRemainingM: 1200, stage: 'enroute', stateLastTransitionAt: mins(20) },
    { orderId: 'ord_active', etaSeconds: 300, etaLastComputedAt: secs(15), riderLat: 12.935, riderLng: 77.624, riderLastGpsAt: secs(8), distanceRemainingM: 900, stage: 'enroute', stateLastTransitionAt: secs(90) },
  ]);

  // One active (escalated) thread for the inbox + a couple of closed ones for the archives.
  await db.insert(conversations).values([
    { id: 'cnv_active', customerId: CUSTOMER, channel: 'whatsapp', status: 'escalated', subject: 'Charged twice for one order', sentiment: 'angry', escalationReason: 'payment dispute outside auto-resolve policy', createdAt: mins(6), updatedAt: mins(5) },
    { id: 'cnv_closed_1', customerId: CUSTOMER, channel: 'web', status: 'closed', subject: "Something's not right with my order", sentiment: 'neutral', createdAt: days(1), updatedAt: plusMins(days(1), 10) },
    { id: 'cnv_closed_2', customerId: CUSTOMER, channel: 'web', status: 'closed', subject: "Where's my order?", sentiment: 'neutral', createdAt: days(2), updatedAt: plusMins(days(2), 7) },
  ]);

  await db.insert(messages).values([
    // Escalated payment dispute → a human teammate stepped in (shows the inbox → agent reply flow).
    { id: 'msg_a1', conversationId: 'cnv_active', role: 'user', text: 'I was charged twice for the same order and no one is helping!' },
    { id: 'msg_a2', conversationId: 'cnv_active', role: 'assistant', text: "I'm really sorry, Arjun. A double charge needs a teammate to verify the payment — I've escalated this with all your details so you won't have to repeat anything." },
    { id: 'msg_a3', conversationId: 'cnv_active', role: 'agent', text: "Hi Arjun, Meera from Swish here. I can see the duplicate ₹198 charge — I've reversed it to your UPI and it'll reflect within 24 hours. So sorry for the hassle!" },
    // A resolved food issue → the full consultative flow (understand → ask for proof → resolve).
    { id: 'msg_c1', conversationId: 'cnv_closed_1', role: 'user', text: 'something was off with my order' },
    { id: 'msg_c2', conversationId: 'cnv_closed_1', role: 'assistant', text: "Oh no — I'm sorry, Arjun. What went wrong, and which item was affected?" },
    { id: 'msg_c3', conversationId: 'cnv_closed_1', role: 'user', text: 'the egg bhurji sandwich was completely soggy and cold' },
    { id: 'msg_c4', conversationId: 'cnv_closed_1', role: 'assistant', text: 'That is not the experience we want at all. Could you share a quick photo so I can sort it right away?' },
    { id: 'msg_c5', conversationId: 'cnv_closed_1', role: 'user', text: 'sure, just sent it across' },
    { id: 'msg_c6', conversationId: 'cnv_closed_1', role: 'assistant', text: "Thank you — that's clearly not right. I've added ₹198 to your Swish balance to make up for it, and flagged it to the kitchen. Anything else I can help with?" },
    // A quick WISMO that resolved on its own.
    { id: 'msg_c7', conversationId: 'cnv_closed_2', role: 'user', text: "where's my order? it's been a little while" },
    { id: 'msg_c8', conversationId: 'cnv_closed_2', role: 'assistant', text: 'It was a few minutes out and has since been delivered — marked complete a moment ago. Hope it was delicious! Anything else?' },
  ]);

  await db.insert(resolutions).values([
    { id: 'res_1', conversationId: 'cnv_closed_1', customerId: CUSTOMER, orderId: 'ord_del_2', type: 'refund', amount: 19800, reason: 'spillage', decidedBy: 'bot', status: 'executed', idempotencyKey: 'seed-1', createdAt: days(1) },
    { id: 'res_2', conversationId: 'cnv_closed_2', customerId: CUSTOMER, orderId: 'ord_stuck', type: 'credit', amount: 3000, reason: 'delay goodwill', decidedBy: 'bot', status: 'executed', idempotencyKey: 'seed-2', createdAt: mins(30) },
  ]);

  await db.insert(faqCategories).values(faqSeed.map((c, i) => ({ id: c.id, title: c.title, sortOrder: i })));
  await db.insert(faqArticles).values(faqSeed.flatMap((c) => c.articles.map((a, j) => ({ id: a.id, categoryId: c.id, question: a.question, answer: a.answer, tags: a.tags, sortOrder: j }))));
}

await seed();

console.log('Seeded one profile with orders, history, and FAQ.');
