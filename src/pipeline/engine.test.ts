import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../db/client';
import { conversations } from '../db/schema';
import { createLlm } from '../llm';
import { providers } from '../providers';
import { closeStaleConversations, getConversation } from '../repositories';
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

  it('asks before acting on a vague issue, then resolves a trusted customer', async () => {
    const r1 = await runTurn({ channel: 'web', customerId: 'pc_trust', orderId: 'po_delivered', text: 'my order had a spill' }, deps);
    expect(r1.intent).toBe('order_issue');
    expect(r1.status).toBe('awaiting_user'); // gathers info first — no blind credit
    expect(r1.action).toBeUndefined();
    expect(r1.reply).toMatch(/\?/);
    const r2 = await runTurn({ channel: 'web', customerId: 'pc_trust', orderId: 'po_delivered', conversationId: r1.conversationId, text: 'the paneer roll spilled everywhere and was soaked', image: { mimeType: 'image/jpeg', dataBase64: 'aGVsbG8=' } }, deps);
    expect(r2.status).toBe('resolved'); // photo = proof → credit
    expect(r2.action?.type).toBe('credit');
  });

  it('escalates a high-velocity (fraudy) account once it proposes an action', async () => {
    const r1 = await runTurn({ channel: 'web', customerId: 'pc_fraud', orderId: 'po_fraud_delivered', text: 'I got the wrong item' }, deps);
    expect(r1.status).toBe('awaiting_user');
    const r2 = await runTurn({ channel: 'web', customerId: 'pc_fraud', orderId: 'po_fraud_delivered', conversationId: r1.conversationId, text: 'it was completely the wrong item, please refund me', image: { mimeType: 'image/jpeg', dataBase64: 'aGVsbG8=' } }, deps);
    expect(r2.intent).toBe('order_issue');
    expect(r2.status).toBe('escalated'); // photo present → reaches policy → fraud velocity trips
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

  it('greets via the LLM-classified tail path and keeps the chat open', async () => {
    const r = await runTurn({ channel: 'web', text: 'hi there!' }, deps);
    expect(r.intent).toBe('greeting');
    expect(r.status).toBe('awaiting_user');
  });

  it('does NOT parrot a stuck ETA — it stays honest and escalates instead of guessing or auto-crediting', async () => {
    const r = await runTurn({ channel: 'web', customerId: 'pc_trust', orderId: 'po_stuck', text: 'where is my order?? still says 3 min' }, deps);
    expect(r.intent).toBe('order_status');
    expect(r.status).toBe('escalated');
    expect(r.reply).not.toMatch(/\b3 min\b/);
    expect(r.reply).toMatch(/reliable|checking|behind|can'?t/i);
    expect(r.action).toBeUndefined(); // no random late-credit
  });

  it('uses a photo to corroborate a claim and auto-resolves', async () => {
    const r = await runTurn(
      { channel: 'web', customerId: 'pc_trust', orderId: 'po_img', text: 'the lid came off and it spilled', image: { mimeType: 'image/jpeg', dataBase64: 'aGVsbG8gc3dpc2g=' } },
      deps,
    );
    expect(r.intent).toBe('order_issue');
    expect(r.status).toBe('resolved');
    expect(r.action?.type).toBe('credit');
  });

  it('confirms before closing, then archives the thread', async () => {
    const r1 = await runTurn({ channel: 'web', customerId: 'pc_trust', text: "thanks, that's all!" }, deps);
    expect(r1.intent).toBe('closing');
    expect(r1.status).toBe('awaiting_user'); // asks "anything else?" first
    const r2 = await runTurn({ channel: 'web', customerId: 'pc_trust', conversationId: r1.conversationId, text: "no, that's it" }, deps);
    expect((await getConversation(r2.conversationId))?.status).toBe('closed');
  });

  it('auto-closes a thread after inactivity', async () => {
    const r = await runTurn({ channel: 'web', customerId: 'pc_trust', orderId: 'po_active', text: 'where is my order?' }, deps);
    await db.update(conversations).set({ updatedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(conversations.id, r.conversationId));
    await closeStaleConversations(10 * 60_000);
    expect((await getConversation(r.conversationId))?.status).toBe('closed');
  });
});
