import { beforeAll, describe, expect, it } from 'vitest';
import { getOrder, getWallet } from '../repositories';
import { migrateTestDb, seedExecutorFixture } from '../test/db';
import { mockExecutor } from './executor';

beforeAll(async () => {
  await migrateTestDb();
  await seedExecutorFixture();
});

describe('mockExecutor', () => {
  it('executes a valid refund and is idempotent on the same key', async () => {
    const first = await mockExecutor.execute({ type: 'refund', orderId: 'o_delivered', amount: 10000, conversationId: 'cv1', customerId: 'c1', reason: 'spillage', idempotencyKey: 'idem-refund-1' });
    expect(first.status).toBe('executed');

    const replay = await mockExecutor.execute({ type: 'refund', orderId: 'o_delivered', amount: 10000, conversationId: 'cv1', customerId: 'c1', reason: 'spillage', idempotencyKey: 'idem-refund-1' });
    expect(replay.status).toBe('duplicate');
    expect(replay.resolutionId).toBe(first.resolutionId);
  });

  it('rejects a refund that exceeds the order total', async () => {
    const r = await mockExecutor.execute({ type: 'refund', orderId: 'o_delivered', amount: 99_999_999, conversationId: 'cv1', customerId: 'c1', reason: 'overclaim', idempotencyKey: 'idem-big' });
    expect(r.status).toBe('failed');
  });

  it('cancels an order still in "placed"', async () => {
    const r = await mockExecutor.execute({ type: 'cancel', orderId: 'o_placed', conversationId: 'cv1', customerId: 'c1', reason: 'changed mind', idempotencyKey: 'idem-cancel-1' });
    expect(r.status).toBe('executed');
    expect((await getOrder('o_placed'))?.status).toBe('cancelled');
  });

  it('refuses to cancel a delivered order', async () => {
    const r = await mockExecutor.execute({ type: 'cancel', orderId: 'o_delivered', conversationId: 'cv1', customerId: 'c1', reason: 'too late', idempotencyKey: 'idem-cancel-2' });
    expect(r.status).toBe('failed');
  });

  it('credits the wallet by the exact amount', async () => {
    const before = (await getWallet('c1'))!.creditBalance;
    const r = await mockExecutor.execute({ type: 'credit', amount: 5000, conversationId: 'cv1', customerId: 'c1', reason: 'goodwill', idempotencyKey: 'idem-credit-1' });
    expect(r.status).toBe('executed');
    const after = (await getWallet('c1'))!.creditBalance;
    expect(after - before).toBe(5000);
  });
});
