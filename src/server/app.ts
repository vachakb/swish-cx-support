import { Hono } from 'hono';
import * as z from 'zod';
import { engine } from '../app';
import { parseInbound, sendMessage, verifyWebhook } from '../channels/whatsapp';
import { config } from '../config';
import { channels, conversationStatuses, orderStatuses } from '../db/schema';
import { faqCategories } from '../faq/content';
import * as repo from '../repositories';

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
  await repo.addMessage({ conversationId: cid, role: 'agent', text: body.text });
  await repo.updateConversation(cid, { status: 'resolved', assignedTo: 'agent' });
  return c.json({ ok: true });
});

// --- Arena: scenarios + profiles + orders ---
app.get('/api/faq', (c) => c.json(faqCategories));
app.get('/api/scenarios', async (c) => c.json(await repo.listScenarios()));
app.get('/api/profiles', async (c) => c.json(await repo.listCustomers()));

app.get('/api/profiles/:id', async (c) => {
  const customer = await repo.getCustomer(c.req.param('id'));
  if (!customer) return c.json({ error: 'not found' }, 404);
  const [wallet, orders] = await Promise.all([repo.getWallet(customer.id), repo.listOrdersByCustomer(customer.id)]);
  return c.json({ customer, wallet, orders });
});

const ProfileBody = z.object({ name: z.string().min(1), phone: z.string().optional(), city: z.string().optional(), area: z.string().optional(), accountAgeDays: z.number().int().optional() });
app.post('/api/profiles', async (c) => {
  const body = parse(ProfileBody, await c.req.json().catch(() => null));
  if (!body) return c.json({ error: 'invalid body' }, 400);
  return c.json(await repo.createProfile(body), 201);
});

const OrderBody = z.object({
  status: z.enum(orderStatuses).optional(),
  items: z.array(z.object({ name: z.string(), quantity: z.number().int().positive(), unitPrice: z.number().int().nonnegative() })).min(1),
  addressArea: z.string().optional(),
  promisedInMin: z.number().optional(),
  tracking: z.object({ etaSeconds: z.number().int(), etaAgeSec: z.number().optional(), gpsAgeSec: z.number().optional(), stateAgeSec: z.number().optional(), distanceRemainingM: z.number().optional() }).optional(),
});
app.post('/api/profiles/:id/orders', async (c) => {
  const body = parse(OrderBody, await c.req.json().catch(() => null));
  if (!body) return c.json({ error: 'invalid body' }, 400);
  const orderId = await repo.createOrder({ customerId: c.req.param('id'), ...body });
  return c.json({ orderId }, 201);
});

// --- WhatsApp Cloud API webhook (real contract; sim mode echoes the reply) ---
app.get('/api/whatsapp/webhook', (c) => {
  const challenge = verifyWebhook({ mode: c.req.query('hub.mode'), token: c.req.query('hub.verify_token'), challenge: c.req.query('hub.challenge') });
  return challenge !== null ? c.text(challenge) : c.text('forbidden', 403);
});

app.post('/api/whatsapp/webhook', async (c) => {
  const inbound = parseInbound(await c.req.json().catch(() => null));
  if (!inbound) return c.json({ ok: true }); // ignore non-text/status events
  const customer = await repo.getCustomerByPhone(inbound.from);
  const result = await engine.run({ channel: 'whatsapp', text: inbound.text, customerId: customer?.id });
  await sendMessage(inbound.from, result.reply);
  return c.json({ ok: true, reply: result.reply, result });
});
