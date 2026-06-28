import { beforeAll, describe, expect, it } from 'vitest';
import { parseInbound } from '../channels/whatsapp';
import { migrateTestDb, seedPipelineFixture } from '../test/db';
import { app } from './app';

beforeAll(async () => {
  await migrateTestDb();
  await seedPipelineFixture();
});

const post = (path: string, body: unknown) =>
  app.fetch(new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const get = (path: string) => app.fetch(new Request(`http://localhost${path}`));

describe('API', () => {
  it('POST /api/chat resolves a WISMO query and returns a trace', async () => {
    const res = await post('/api/chat', { channel: 'web', customerId: 'pc_trust', orderId: 'po_active', text: 'where is my order?' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { intent: string }; trace: unknown };
    expect(body.result.intent).toBe('order_status');
    expect(body.trace).toBeTruthy();
  });

  it('POST /api/chat rejects an empty body', async () => {
    const res = await post('/api/chat', { channel: 'web' });
    expect(res.status).toBe(400);
  });

  it('GET /api/whatsapp/webhook returns the challenge on a valid verify', async () => {
    const res = await get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=swish-verify&hub.challenge=xyz');
    expect(await res.text()).toBe('xyz');
  });

  it('GET /api/scenarios returns a list', async () => {
    const res = await get('/api/scenarios');
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('parseInbound reads a real WABA text payload and ignores junk', () => {
    const payload = { entry: [{ changes: [{ value: { messages: [{ from: '919900000000', id: 'wamid.1', type: 'text', text: { body: 'hi' } }] } }] }] };
    expect(parseInbound(payload)?.text).toBe('hi');
    expect(parseInbound({})).toBeNull();
  });
});
