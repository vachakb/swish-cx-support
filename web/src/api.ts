import type { ChatResponse, Conversation, Customer, FaqCategory, Message, Order, OrderWithItems, Refund, Scenario, Trace, Wallet } from './types';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

const postJson = <T>(url: string, body: unknown) =>
  jsonFetch<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export interface ChatBody {
  conversationId?: string;
  customerId?: string;
  orderId?: string;
  channel: 'web' | 'whatsapp';
  text: string;
  image?: { mimeType: string; dataBase64: string };
  intake?: { role: 'user' | 'assistant'; text: string }[];
}

export const api = {
  chat: (body: ChatBody) => postJson<ChatResponse>('/api/chat', body),
  faq: () => jsonFetch<FaqCategory[]>('/api/faq'),
  scenarios: () => jsonFetch<Scenario[]>('/api/scenarios'),
  profiles: () => jsonFetch<Customer[]>('/api/profiles'),
  profile: (id: string) => jsonFetch<{ customer: Customer; wallet: Wallet | null; orders: Order[] }>(`/api/profiles/${id}`),
  createProfile: (body: { name: string; area?: string; accountAgeDays?: number }) => postJson<Customer>('/api/profiles', body),
  createOrder: (id: string, body: unknown) => postJson<{ orderId: string }>(`/api/profiles/${id}/orders`, body),
  orders: (id: string) => jsonFetch<OrderWithItems[]>(`/api/profiles/${id}/orders`),
  threads: (id: string) => jsonFetch<Conversation[]>(`/api/profiles/${id}/threads`),
  refunds: (id: string) => jsonFetch<{ refunds: Refund[]; activeCount: number }>(`/api/profiles/${id}/refunds`),
  inbox: (status?: string) => jsonFetch<Conversation[]>(`/api/conversations${status ? `?status=${status}` : ''}`),
  conversation: (id: string) => jsonFetch<{ conversation: Conversation; messages: Message[]; traces: Trace[] }>(`/api/conversations/${id}`),
  agentReply: (id: string, text: string) => postJson<{ ok: boolean }>(`/api/conversations/${id}/agent-reply`, { text }),
  reopen: (id: string) => postJson<{ ok: boolean }>(`/api/conversations/${id}/reopen`, {}),
  whatsapp: (payload: unknown, orderId?: string) =>
    postJson<{ ok: boolean; reply?: string; outbound?: unknown; mode?: string }>(`/api/whatsapp/webhook${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ''}`, payload),
};
