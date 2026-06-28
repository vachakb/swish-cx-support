import { beforeAll, describe, expect, it } from 'vitest';
import { createLlm } from '../llm';
import { providers } from '../providers';
import { migrateTestDb, seedPipelineFixture } from '../test/db';
import { runTurn } from './engine';
import { buildMockHandlers } from './mock-llm';

const deps = { llm: createLlm(buildMockHandlers()), providers };

beforeAll(async () => {
  await migrateTestDb();
  await seedPipelineFixture();
});

describe('pipeline runTurn (mock LLM)', () => {
  it('routes WISMO and returns an ETA', async () => {
    const r = await runTurn({ channel: 'web', customerId: 'pc_trust', orderId: 'po_active', text: 'where is my order?' }, deps);
    expect(r.intent).toBe('order_status');
    expect(r.status).toBe('resolved');
    expect(r.reply).toMatch(/min/);
  });

  it('auto-resolves a spillage claim for a trusted customer (issues credit)', async () => {
    const r = await runTurn({ channel: 'web', customerId: 'pc_trust', orderId: 'po_delivered', text: 'my order was completely spilled' }, deps);
    expect(r.intent).toBe('order_issue');
    expect(r.status).toBe('resolved');
    expect(r.action?.type).toBe('credit');
  });

  it('escalates a claim from a high-velocity (fraudy) account', async () => {
    const r = await runTurn({ channel: 'web', customerId: 'pc_fraud', orderId: 'po_fraud_delivered', text: 'this is the wrong order, refund me' }, deps);
    expect(r.intent).toBe('order_issue');
    expect(r.status).toBe('escalated');
  });

  it('answers the referral-reward hybrid from wallet data', async () => {
    const r = await runTurn({ channel: 'web', customerId: 'pc_trust', text: 'where is my referral reward?' }, deps);
    expect(r.intent).toBe('referral_status');
    expect(r.reply).toMatch(/50/);
    expect(r.status).toBe('resolved');
  });

  it('blocks garbage input at the guard', async () => {
    const r = await runTurn({ channel: 'web', text: '@#$%^&*()' }, deps);
    expect(r.status).toBe('awaiting_user');
  });

  it('escalates on an explicit human request', async () => {
    const r = await runTurn({ channel: 'web', text: 'I want to talk to a human' }, deps);
    expect(r.intent).toBe('human');
    expect(r.status).toBe('escalated');
  });

  it('greets via the LLM-classified tail path', async () => {
    const r = await runTurn({ channel: 'web', text: 'hi there!' }, deps);
    expect(r.intent).toBe('greeting');
    expect(r.status).toBe('resolved');
  });
});
