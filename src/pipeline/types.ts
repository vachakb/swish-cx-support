import { sentiments } from '../db/schema';
import type { LlmProvider } from '../llm';
import type { ActionRequest, Providers } from '../providers/types';
import type { Conversation, Message } from '../repositories';
import type { Tracer } from './tracer';

export const intents = [
  'greeting',
  'faq',
  'referral_status',
  'refund_status',
  'order_status',
  'order_issue',
  'cancel_order',
  'human',
  'closing',
  'unknown',
] as const;
export type Intent = (typeof intents)[number];

export type Sentiment = (typeof sentiments)[number];
export { sentiments };

export interface RouteResult {
  intent: Intent;
  confidence: number;
  sentiment: Sentiment;
  language: string;
  orderRef?: string;
}

export interface TurnInput {
  conversationId?: string;
  customerId?: string;
  orderId?: string;
  channel: 'web' | 'whatsapp';
  text: string;
  image?: { mimeType: string; dataBase64: string };
  intake?: { role: 'user' | 'assistant'; text: string }[]; // guided-intake transcript to persist on the first turn
}

export interface TurnContext {
  input: TurnInput;
  conversation: Conversation;
  history: Message[];
  route: RouteResult;
  customerId?: string;
  orderId?: string;
}

export type TurnStatus = 'resolved' | 'awaiting_user' | 'escalated' | 'closed';

export interface HandlerResult {
  reply: string;
  status: TurnStatus;
  action?: ActionRequest;
  escalationReason?: string;
  data?: Record<string, unknown>; // structured payload the UI renders (eta card, refund card, …)
  polish?: boolean; // override the default: ask (or skip) the composer's voice round-trip
  suggestions?: string[]; // tappable quick-reply options offered to the customer
}

export interface TurnResult extends HandlerResult {
  conversationId: string;
  traceId: string;
  intent: Intent;
  sentiment: Sentiment;
  latencyMs: number;
}

export interface HandlerDeps {
  llm: LlmProvider;
  providers: Providers;
  tracer: Tracer;
}

export interface Handler {
  readonly intents: Intent[];
  handle(ctx: TurnContext, deps: HandlerDeps): Promise<HandlerResult>;
}
