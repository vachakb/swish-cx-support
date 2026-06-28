import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from '../db/client';
import { conversations, customers, orderTracking, orders, resolutions, serviceability, wallets } from '../db/schema';

// Applies the schema to the per-file in-memory DB (DATABASE_URL=:memory: in vitest config).
export async function migrateTestDb(): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' });
}

export async function seedExecutorFixture(): Promise<void> {
  await db.insert(customers).values([
    { id: 'c1', name: 'Test User', phone: '+919000000000', city: 'Bengaluru', area: 'HSR Layout', accountAgeDays: 100 },
  ]);
  await db.insert(wallets).values([{ customerId: 'c1', creditBalance: 0, referralCode: 'T1' }]);
  await db.insert(conversations).values([{ id: 'cv1', customerId: 'c1', channel: 'web', status: 'bot' }]);
  await db.insert(orders).values([
    { id: 'o_placed', customerId: 'c1', status: 'placed', placedAt: new Date(), promisedBy: new Date(Date.now() + 600_000), podId: 'p1', addressArea: 'HSR Layout', subtotal: 20000, total: 20000, paymentMethod: 'upi' },
    { id: 'o_delivered', customerId: 'c1', status: 'delivered', placedAt: new Date(Date.now() - 3_600_000), promisedBy: new Date(Date.now() - 3_000_000), deliveredAt: new Date(Date.now() - 3_000_000), podId: 'p1', addressArea: 'HSR Layout', subtotal: 30000, total: 30000, paymentMethod: 'upi' },
  ]);
}

// Fixture for the end-to-end pipeline tests: a trusted customer + a high-velocity (fraudy) one.
export async function seedPipelineFixture(): Promise<void> {
  const now = Date.now();
  await db.insert(customers).values([
    { id: 'pc_trust', name: 'Trusted', phone: '+910000000001', city: 'Bengaluru', area: 'HSR Layout', accountAgeDays: 400 },
    { id: 'pc_fraud', name: 'Repeat Claimant', phone: '+910000000002', city: 'Bengaluru', area: 'Indiranagar', accountAgeDays: 10 },
  ]);
  await db.insert(wallets).values([
    { customerId: 'pc_trust', creditBalance: 0, referralCode: 'T1', referralRewardPending: 5000 },
    { customerId: 'pc_fraud', creditBalance: 0, referralCode: 'F1' },
  ]);
  await db.insert(serviceability).values([
    { id: 'sv1', city: 'Bengaluru', area: 'HSR Layout', serviceable: true },
    { id: 'sv2', city: 'Bengaluru', area: 'Jayanagar', serviceable: false, note: 'launching soon' },
  ]);
  await db.insert(orders).values([
    { id: 'po_active', customerId: 'pc_trust', status: 'dispatched', placedAt: new Date(now - 240_000), promisedBy: new Date(now + 360_000), podId: 'p1', riderId: 'r1', addressArea: 'HSR Layout', subtotal: 22000, total: 22000, paymentMethod: 'upi' },
    { id: 'po_delivered', customerId: 'pc_trust', status: 'delivered', placedAt: new Date(now - 3_600_000), promisedBy: new Date(now - 3_000_000), deliveredAt: new Date(now - 3_000_000), podId: 'p1', addressArea: 'HSR Layout', subtotal: 20000, total: 20000, paymentMethod: 'upi' },
    { id: 'po_fraud_delivered', customerId: 'pc_fraud', status: 'delivered', placedAt: new Date(now - 3_600_000), promisedBy: new Date(now - 3_000_000), deliveredAt: new Date(now - 3_000_000), podId: 'p2', addressArea: 'Indiranagar', subtotal: 28000, total: 28000, paymentMethod: 'upi' },
  ]);
  await db.insert(orderTracking).values([
    { orderId: 'po_active', etaSeconds: 300, etaLastComputedAt: new Date(now - 15_000), riderLat: 12.9, riderLng: 77.6, riderLastGpsAt: new Date(now - 8_000), distanceRemainingM: 800, stage: 'enroute', stateLastTransitionAt: new Date(now - 90_000) },
  ]);
  await db.insert(conversations).values([{ id: 'cv_fraud_hist', customerId: 'pc_fraud', channel: 'web', status: 'resolved' }]);
  await db.insert(resolutions).values([
    { id: 'rf1', conversationId: 'cv_fraud_hist', customerId: 'pc_fraud', type: 'refund', amount: 18000, reason: 'spillage', decidedBy: 'bot', status: 'executed', idempotencyKey: 'pf1', createdAt: new Date(now - 86_400_000) },
    { id: 'rf2', conversationId: 'cv_fraud_hist', customerId: 'pc_fraud', type: 'credit', amount: 12000, reason: 'missing', decidedBy: 'bot', status: 'executed', idempotencyKey: 'pf2', createdAt: new Date(now - 2 * 86_400_000) },
    { id: 'rf3', conversationId: 'cv_fraud_hist', customerId: 'pc_fraud', type: 'refund', amount: 15000, reason: 'wrong', decidedBy: 'bot', status: 'executed', idempotencyKey: 'pf3', createdAt: new Date(now - 3 * 86_400_000) },
  ]);
}
