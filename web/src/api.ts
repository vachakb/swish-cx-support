import type { ChatResponse, Conversation, Customer, Message, Order, Scenario, Trace, Wallet } from './types';

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
}

export const api = {
  chat: (body: ChatBody) => postJson<ChatResponse>('/api/chat', body),
  scenarios: () => jsonFetch<Scenario[]>('/api/scenarios'),
  profiles: () => jsonFetch<Customer[]>('/api/profiles'),
  profile: (id: string) => jsonFetch<{ customer: Customer; wallet: Wallet | null; orders: Order[] }>(`/api/profiles/${id}`),
  createProfile: (body: { name: string; area?: string; accountAgeDays?: number }) => postJson<Customer>('/api/profiles', body),
  inbox: (status?: string) => jsonFetch<Conversation[]>(`/api/conversations${status ? `?status=${status}` : ''}`),
  conversation: (id: string) => jsonFetch<{ conversation: Conversation; messages: Message[]; traces: Trace[] }>(`/api/conversations/${id}`),
  agentReply: (id: string, text: string) => postJson<{ ok: boolean }>(`/api/conversations/${id}/agent-reply`, { text }),
};
