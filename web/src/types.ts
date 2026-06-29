export interface Customer {
  id: string;
  name: string;
  phone: string;
  city: string;
  area: string;
  accountAgeDays: number;
}

export interface Wallet {
  customerId: string;
  creditBalance: number;
  referralCode: string;
  referralRewardPending: number;
  referralRewardEarned: number;
}

export interface Order {
  id: string;
  status: string;
  subtotal: number;
  total: number;
  addressArea: string;
  placedAt: string;
  promisedBy: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface Refund {
  id: string;
  type: 'refund' | 'credit';
  amount: number | null;
  reason: string;
  orderId: string | null;
  createdAt: string;
  status: 'processing' | 'completed';
  active: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  customerId: string;
  orderId?: string | null;
  channel: 'web' | 'whatsapp';
  suggestedMessage: string;
  tags?: string[] | null;
}

export interface TraceStep {
  stage: string;
  ms: number;
  data?: Record<string, unknown>;
}

export interface Trace {
  id: string;
  intent?: string | null;
  confidence?: number | null;
  sentiment?: string | null;
  latencyMs?: number | null;
  steps?: TraceStep[] | null;
}

export interface TurnResult {
  conversationId: string;
  traceId: string;
  reply: string;
  status: 'resolved' | 'awaiting_user' | 'escalated';
  intent: string;
  sentiment: string;
  latencyMs: number;
  action?: { type: string };
  data?: Record<string, unknown>;
  suggestions?: string[];
}

export interface ChatResponse {
  result: TurnResult;
  trace: Trace | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'agent' | 'system';
  text: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
}

export interface FaqArticle {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

export interface FaqCategory {
  id: string;
  title: string;
  articles: FaqArticle[];
}

export interface Conversation {
  id: string;
  channel: 'web' | 'whatsapp';
  status: string;
  subject?: string | null;
  sentiment?: string | null;
  customerId?: string | null;
  escalationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}
