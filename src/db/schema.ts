import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type {
  IntegrityVerdict,
  MessagePayload,
  PolicyTrace,
  TraceStep,
  VisionScore,
} from '../types';

// String unions enforced at the type layer (SQLite has no native enums).
export const orderStatuses = ['placed', 'preparing', 'packed', 'dispatched', 'arriving', 'delivered', 'cancelled'] as const;
export const riderStages = ['assigned', 'at_pod', 'enroute', 'near', 'arrived'] as const;
export const channels = ['web', 'whatsapp'] as const;
export const conversationStatuses = ['bot', 'awaiting_user', 'escalated', 'resolved', 'closed'] as const;
export const messageRoles = ['user', 'assistant', 'system', 'agent'] as const;
export const resolutionTypes = ['refund', 'credit', 'redeliver', 'cancel', 'reassign_rider', 'none'] as const;
export const resolutionStatuses = ['proposed', 'approved', 'executed', 'rejected', 'failed'] as const;
export const sentiments = ['positive', 'neutral', 'negative', 'angry'] as const;
export const paymentMethods = ['upi', 'card', 'cod', 'wallet'] as const;

const createdAt = () => integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());

// All money is stored in paise (integer) to avoid float errors.

export const customers = sqliteTable('customers', {
  id: text().primaryKey(),
  name: text().notNull(),
  phone: text().notNull(),
  email: text(),
  city: text().notNull(),
  area: text().notNull(),
  accountAgeDays: integer().notNull().default(0),
  locale: text().notNull().default('en'),
  isValid: integer({ mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const wallets = sqliteTable('wallets', {
  customerId: text().primaryKey().references(() => customers.id),
  creditBalance: integer().notNull().default(0),
  referralCode: text().notNull(),
  referralsCompleted: integer().notNull().default(0),
  referralRewardEarned: integer().notNull().default(0),
  referralRewardPending: integer().notNull().default(0),
  updatedAt: createdAt(),
});

export const serviceability = sqliteTable('serviceability', {
  id: text().primaryKey(),
  city: text().notNull(),
  area: text().notNull(),
  serviceable: integer({ mode: 'boolean' }).notNull(),
  note: text(),
});

export const orders = sqliteTable('orders', {
  id: text().primaryKey(),
  customerId: text().notNull().references(() => customers.id),
  status: text({ enum: orderStatuses }).notNull(),
  placedAt: integer({ mode: 'timestamp_ms' }).notNull(),
  promisedBy: integer({ mode: 'timestamp_ms' }).notNull(),
  deliveredAt: integer({ mode: 'timestamp_ms' }),
  podId: text().notNull(),
  riderId: text(),
  addressArea: text().notNull(),
  subtotal: integer().notNull(),
  deliveryFee: integer().notNull().default(0),
  total: integer().notNull(),
  paymentMethod: text({ enum: paymentMethods }).notNull(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const orderItems = sqliteTable('order_items', {
  id: text().primaryKey(),
  orderId: text().notNull().references(() => orders.id),
  name: text().notNull(),
  quantity: integer().notNull(),
  unitPrice: integer().notNull(),
});

// One live-tracking snapshot per order. The timestamp fields are the
// staleness signals the ETA Truth module reasons over.
export const orderTracking = sqliteTable('order_tracking', {
  orderId: text().primaryKey().references(() => orders.id),
  etaSeconds: integer().notNull(),
  etaLastComputedAt: integer({ mode: 'timestamp_ms' }).notNull(),
  riderLat: real(),
  riderLng: real(),
  riderLastGpsAt: integer({ mode: 'timestamp_ms' }),
  distanceRemainingM: integer(),
  stage: text({ enum: riderStages }).notNull(),
  stateLastTransitionAt: integer({ mode: 'timestamp_ms' }).notNull(),
  updatedAt: createdAt(),
});

export const conversations = sqliteTable('conversations', {
  id: text().primaryKey(),
  customerId: text().references(() => customers.id),
  orderId: text().references(() => orders.id),
  channel: text({ enum: channels }).notNull(),
  status: text({ enum: conversationStatuses }).notNull().default('bot'),
  subject: text(),
  sentiment: text({ enum: sentiments }),
  assignedTo: text(),
  escalationReason: text(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const messages = sqliteTable('messages', {
  id: text().primaryKey(),
  conversationId: text().notNull().references(() => conversations.id),
  role: text({ enum: messageRoles }).notNull(),
  text: text().notNull(),
  payload: text({ mode: 'json' }).$type<MessagePayload>(),
  traceId: text(),
  createdAt: createdAt(),
});

export const attachments = sqliteTable('attachments', {
  id: text().primaryKey(),
  conversationId: text().notNull().references(() => conversations.id),
  messageId: text().references(() => messages.id),
  url: text().notNull(),
  sha256: text().notNull(),
  integrityVerdict: text({ mode: 'json' }).$type<IntegrityVerdict>(),
  visionScore: text({ mode: 'json' }).$type<VisionScore>(),
  createdAt: createdAt(),
});

// Action ledger. idempotencyKey is unique so a refund can never execute twice.
export const resolutions = sqliteTable('resolutions', {
  id: text().primaryKey(),
  conversationId: text().notNull().references(() => conversations.id),
  customerId: text().notNull().references(() => customers.id),
  orderId: text().references(() => orders.id),
  type: text({ enum: resolutionTypes }).notNull(),
  amount: integer(),
  reason: text().notNull(),
  decidedBy: text({ enum: ['bot', 'human', 'policy'] }).notNull(),
  status: text({ enum: resolutionStatuses }).notNull(),
  idempotencyKey: text().notNull().unique(),
  policyTrace: text({ mode: 'json' }).$type<PolicyTrace>(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const auditLog = sqliteTable('audit_log', {
  id: text().primaryKey(),
  conversationId: text(),
  actor: text({ enum: ['bot', 'human', 'system'] }).notNull(),
  action: text().notNull(),
  detail: text({ mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

// Pre-built arena scenarios: pick one to load a profile + order + starter message.
export const scenarios = sqliteTable('scenarios', {
  id: text().primaryKey(),
  title: text().notNull(),
  description: text().notNull(),
  customerId: text().notNull().references(() => customers.id),
  orderId: text().references(() => orders.id),
  channel: text({ enum: channels }).notNull().default('web'),
  suggestedMessage: text().notNull(),
  tags: text({ mode: 'json' }).$type<string[]>(),
});

export const traces = sqliteTable('traces', {
  id: text().primaryKey(),
  conversationId: text().notNull(),
  messageId: text(),
  intent: text(),
  confidence: real(),
  sentiment: text(),
  latencyMs: integer(),
  steps: text({ mode: 'json' }).$type<TraceStep[]>(),
  createdAt: createdAt(),
});

// Self-serve Help content — editable as data rather than hard-coded.
export const faqCategories = sqliteTable('faq_categories', {
  id: text().primaryKey(),
  title: text().notNull(),
  sortOrder: integer().notNull().default(0),
});

export const faqArticles = sqliteTable('faq_articles', {
  id: text().primaryKey(),
  categoryId: text().notNull().references(() => faqCategories.id),
  question: text().notNull(),
  answer: text().notNull(),
  tags: text({ mode: 'json' }).$type<string[]>(),
  sortOrder: integer().notNull().default(0),
});
