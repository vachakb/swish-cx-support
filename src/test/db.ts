import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from '../db/client';
import { conversations, customers, orders, wallets } from '../db/schema';

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
