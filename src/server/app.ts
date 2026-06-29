import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import * as z from 'zod';
import { engine } from '../app';
import { buildSendPayload, parseInbound, sendMessage, verifyWebhook } from '../channels/whatsapp';
import { config } from '../config';
import { channels, conversationStatuses } from '../db/schema';
import { publishMessage, subscribeCustomer, subscribeMessages } from '../notifications/bus';
import { REFUND_PROCESSING_MS } from '../policy/config';
import * as repo from '../repositories';

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const app = new Hono();

function parse<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}

app.get('/api/health', (c) => c.json({ status: 'ok', provider: config.llmProvider, whatsapp: config.whatsapp.live ? 'live' : 'sim' }));

// --- Chat (web channel) ---
const ChatBody = z.object({
  conversationId: z.string().optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  channel: z.enum(channels).default('web'),
  text: z.string().min(1),
  image: z.object({ mimeType: z.string(), dataBase64: z.string() }).optional(),
  intake: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() })).optional(),
});

app.post('/api/chat', async (c) => {
  const body = parse(ChatBody, await c.req.json().catch(() => null));
  if (!body) return c.json({ error: 'invalid body' }, 400);
  const result = await engine.run(body);
  const trace = result.traceId ? await repo.getTrace(result.traceId) : null;
  return c.json({ result, trace });
});

// --- Shared inbox ---
app.get('/api/conversations', async (c) => {
  const s = c.req.query('status');
  const status = s && (conversationStatuses as readonly string[]).includes(s) ? (s as (typeof conversationStatuses)[number]) : undefined;
  return c.json(await repo.listInbox(status));
});

app.get('/api/conversations/:id', async (c) => {
  const conversation = await repo.getConversation(c.req.param('id'));
  if (!conversation) return c.json({ error: 'not found' }, 404);
  const [messages, traces] = await Promise.all([repo.listMessages(conversation.id), repo.listTracesByConversation(conversation.id)]);
  return c.json({ conversation, messages, traces });
});

app.post('/api/conversations/:id/agent-reply', async (c) => {
  const body = parse(z.object({ text: z.string().min(1) }), await c.req.json().catch(() => null));
  if (!body) return c.json({ error: 'invalid body' }, 400);
  const cid = c.req.param('id');
  const message = await repo.addMessage({ conversationId: cid, role: 'agent', text: body.text });
  await repo.updateConversation(cid, { status: 'resolved', assignedTo: 'agent' });
  publishMessage(cid, message); // push to the open chat over SSE
  return c.json({ ok: true });
});

// Live SSE stream of a conversation's messages — the open chat gets an agent reply instantly.
app.get('/api/conversations/:id/events', (c) =>
  streamSSE(c, async (stream) => {
    const cid = c.req.param('id');
    const unsub = subscribeMessages(cid, (m) => {
      void stream.writeSSE({ event: 'message', id: m.id, data: JSON.stringify(m) });
    });
    stream.onAbort(unsub);
    while (!c.req.raw.signal.aborted) {
      await stream.sleep(25_000); // keep-alive ping so idle proxies don't drop it
      await stream.writeSSE({ event: 'ping', data: '' });
    }
    unsub();
  }),
);

// Customer-level SSE stream: proactive nudges (e.g. a late-order heads-up) wherever they are in the app.
app.get('/api/customers/:id/events', (c) =>
  streamSSE(c, async (stream) => {
    const id = c.req.param('id');
    const unsub = subscribeCustomer(id, (e) => {
      void stream.writeSSE({ event: 'message', data: JSON.stringify(e) });
    });
    stream.onAbort(unsub);
    while (!c.req.raw.signal.aborted) {
      await stream.sleep(25_000);
      await stream.writeSSE({ event: 'ping', data: '' });
    }
    unsub();
  }),
);

// --- Reference data + customer profile (read-only) ---
app.get('/api/faq', async (c) => c.json(await repo.listFaqCategories()));
app.get('/api/profiles', async (c) => c.json(await repo.listCustomers()));

app.get('/api/profiles/:id', async (c) => {
  const customer = await repo.getCustomer(c.req.param('id'));
  if (!customer) return c.json({ error: 'not found' }, 404);
  const [wallet, orders] = await Promise.all([repo.getWallet(customer.id), repo.listOrdersByCustomer(customer.id)]);
  return c.json({ customer, wallet, orders });
});

// --- Home dashboard: per-customer threads, refunds, recent orders ---
app.get('/api/profiles/:id/orders', async (c) => c.json(await repo.getOrdersWithItems(c.req.param('id'))));

app.get('/api/profiles/:id/threads', async (c) => {
  return c.json(await repo.listConversationsByCustomer(c.req.param('id')));
});

app.get('/api/profiles/:id/refunds', async (c) => {
  const all = await repo.listResolutionsByCustomer(c.req.param('id'));
  const now = Date.now();
  const refunds = all
    .filter((r) => r.type === 'refund' || r.type === 'credit')
    .map((r) => {
      const ageMs = now - new Date(r.createdAt).getTime();
      const processing = r.type === 'refund' && ageMs < REFUND_PROCESSING_MS;
      return { id: r.id, type: r.type, amount: r.amount, reason: r.reason, orderId: r.orderId, createdAt: r.createdAt, status: processing ? 'processing' : 'completed', active: ageMs < REFUND_WINDOW_MS };
    });
  return c.json({ refunds, activeCount: refunds.filter((r) => r.active).length });
});

app.post('/api/conversations/:id/reopen', async (c) => {
  await repo.reopenConversation(c.req.param('id'));
  return c.json({ ok: true });
});

// --- WhatsApp Cloud API webhook (real contract; sim mode echoes the reply) ---
app.get('/api/whatsapp/webhook', (c) => {
  const challenge = verifyWebhook({ mode: c.req.query('hub.mode'), token: c.req.query('hub.verify_token'), challenge: c.req.query('hub.challenge') });
  return challenge !== null ? c.text(challenge) : c.text('forbidden', 403);
});

app.post('/api/whatsapp/webhook', async (c) => {
  const inbound = parseInbound(await c.req.json().catch(() => null));
  if (!inbound) return c.json({ ok: true }); // ignore non-text/status events
  // Meta sends the wa_id as digits; our customers are stored E.164 (+…).
  const phone = inbound.from.startsWith('+') ? inbound.from : `+${inbound.from}`;
  const customer = await repo.getCustomerByPhone(phone);
  // Guided-menu order rides as a query param in the sim (the interactive-reply id in production).
  const orderId = c.req.query('orderId') || undefined;
  const result = await engine.run({ channel: 'whatsapp', text: inbound.text, customerId: customer?.id, orderId });
  await sendMessage(inbound.from, result.reply);
  return c.json({ ok: true, reply: result.reply, outbound: buildSendPayload(inbound.from, result.reply), mode: config.whatsapp.live ? 'live' : 'sim' });
});
