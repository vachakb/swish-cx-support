import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import type { Conversation, Customer, FaqCategory, Message, OrderWithItems, Refund, Wallet } from '../types';
import { ago, inr } from '../util';
import { Faq } from './Faq';

interface HomeProps {
  customerId?: string;
  onOpenChat: () => void;
  onResumeThread: (id: string) => void;
}

type Detail = { customer: Customer; wallet: Wallet | null };

export function Home({ customerId, onOpenChat, onResumeThread }: HomeProps) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [refunds, setRefunds] = useState<{ refunds: Refund[]; activeCount: number }>({ refunds: [], activeCount: 0 });
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [faq, setFaq] = useState<FaqCategory[]>([]);
  const [view, setView] = useState<'home' | 'refunds' | 'threads' | 'orders'>('home');
  const [threadId, setThreadId] = useState<string>();

  const reload = useCallback(() => {
    if (!customerId) return;
    api.profile(customerId).then((d) => setDetail({ customer: d.customer, wallet: d.wallet })).catch(() => {});
    api.refunds(customerId).then(setRefunds).catch(() => {});
    api.threads(customerId).then(setThreads).catch(() => {});
    api.orders(customerId).then(setOrders).catch(() => {});
  }, [customerId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { api.faq().then(setFaq).catch(() => {}); }, []);

  if (threadId) return <ThreadView id={threadId} onBack={() => setThreadId(undefined)} onReopen={() => onResumeThread(threadId)} />;
  if (view === 'refunds') return <ListShell title="Refunds & credits" onBack={() => setView('home')}>{refunds.refunds.length === 0 ? <Empty>No refunds yet.</Empty> : refunds.refunds.map((r) => <RefundRow key={r.id} r={r} />)}</ListShell>;
  if (view === 'threads') return <ListShell title="Your conversations" onBack={() => setView('home')}>{threads.length === 0 ? <Empty>No conversations yet.</Empty> : threads.map((t) => <ThreadRow key={t.id} t={t} onClick={() => setThreadId(t.id)} />)}</ListShell>;
  if (view === 'orders') return <ListShell title="Your orders" onBack={() => setView('home')}>{orders.length === 0 ? <Empty>No orders yet.</Empty> : orders.map((o) => <OrderRow key={o.id} o={o} />)}</ListShell>;

  return (
    <div className="mx-auto h-full max-w-2xl space-y-4 overflow-y-auto p-4">
      <div className="pt-1">
        <div className="text-lg font-semibold text-neutral-900">Hi{detail ? `, ${detail.customer.name.split(' ')[0]}` : ' there'} 👋</div>
        <div className="text-sm text-neutral-500">How can we help today?</div>
      </div>

      <Card title="Active refunds" badge={refunds.activeCount > 0 ? String(refunds.activeCount) : undefined} onViewAll={refunds.refunds.length ? () => setView('refunds') : undefined}>
        {refunds.activeCount === 0 ? <Empty>No active refunds.</Empty> : <div className="space-y-1.5">{refunds.refunds.filter((r) => r.active).slice(0, 2).map((r) => <RefundRow key={r.id} r={r} />)}</div>}
      </Card>

      <Card title="Conversations" onViewAll={threads.length ? () => setView('threads') : undefined}>
        {threads.length === 0 ? <Empty>No conversations yet — start a chat any time.</Empty> : <ThreadRow t={threads[0]!} onClick={() => setThreadId(threads[0]!.id)} />}
      </Card>

      <Card title="Recent orders" onViewAll={orders.length ? () => setView('orders') : undefined}>
        {orders.length === 0 ? <Empty>No orders yet.</Empty> : <OrderCarousel orders={orders.slice(0, 3)} />}
      </Card>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-2.5 text-sm font-semibold text-neutral-800">Help topics</div>
        <Faq categories={faq} onNeedChat={onOpenChat} />
      </section>

      <button onClick={onOpenChat} className="w-full rounded-xl bg-swish-500 py-3 text-sm font-semibold text-white shadow-sm hover:bg-swish-600">Chat with support</button>
    </div>
  );
}

function Card({ title, badge, onViewAll, children }: { title: string; badge?: string; onViewAll?: () => void; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-800">{title}</span>
          {badge && <span className="rounded-full bg-swish-100 px-2 py-0.5 text-xs font-semibold text-swish-700">{badge}</span>}
        </div>
        {onViewAll && <button onClick={onViewAll} className="text-xs font-medium text-swish-600 hover:underline">View all →</button>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="py-1.5 text-sm text-neutral-400">{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    delivered: 'bg-green-100 text-green-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-neutral-100 text-neutral-500',
    cancelled: 'bg-neutral-100 text-neutral-500',
    escalated: 'bg-amber-100 text-amber-700',
    awaiting_user: 'bg-blue-100 text-blue-700',
    arriving: 'bg-blue-100 text-blue-700',
    dispatched: 'bg-blue-100 text-blue-700',
    preparing: 'bg-amber-100 text-amber-700',
    placed: 'bg-amber-100 text-amber-700',
    bot: 'bg-blue-100 text-blue-700',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[status] ?? 'bg-neutral-100 text-neutral-600'}`}>{status}</span>;
}

function RefundRow({ r }: { r: Refund }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
      <div>
        <div className="font-medium text-neutral-800">{r.type === 'credit' ? 'Swish credit' : 'Refund'} · {r.amount != null ? inr(r.amount) : '—'}</div>
        <div className="text-xs text-neutral-400">{r.reason} · {ago(r.createdAt)}</div>
      </div>
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${r.status === 'processing' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{r.status}</span>
    </div>
  );
}

function ThreadRow({ t, onClick }: { t: Conversation; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100">
      <div>
        <div className="text-sm font-medium text-neutral-800">{t.subject ?? 'Conversation'}</div>
        <div className="text-xs text-neutral-400">{t.id.replace('cnv_', '#')} · {ago(t.updatedAt)}</div>
      </div>
      <StatusBadge status={t.status} />
    </button>
  );
}

function itemsSummary(o: OrderWithItems): string {
  return o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ') || '—';
}

function OrderRow({ o }: { o: OrderWithItems }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-800">{o.id.replace('ord_', '#')}</span>
        <StatusBadge status={o.status} />
      </div>
      <div className="mt-0.5 text-xs text-neutral-500">{itemsSummary(o)}</div>
      <div className="mt-0.5 flex justify-between text-xs text-neutral-400"><span>{ago(o.placedAt)}</span><span className="font-medium text-neutral-600">{inr(o.total)}</span></div>
    </div>
  );
}

function OrderCarousel({ orders }: { orders: OrderWithItems[] }) {
  const [i, setI] = useState(0);
  const len = orders.length;
  const idx = ((i % len) + len) % len;
  const o = orders[idx]!;
  return (
    <div>
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-800">{o.id.replace('ord_', '#')}</span>
          <StatusBadge status={o.status} />
        </div>
        <div className="mt-1 text-xs text-neutral-500">{itemsSummary(o)}</div>
        <div className="mt-1 flex justify-between text-xs text-neutral-400"><span>{ago(o.placedAt)}</span><span className="font-semibold text-neutral-700">{inr(o.total)}</span></div>
      </div>
      {len > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <CarouselBtn onClick={() => setI(i - 1)}>‹</CarouselBtn>
          <div className="flex gap-1">{orders.map((ord, d) => <span key={ord.id} className={`h-1.5 w-1.5 rounded-full ${d === idx ? 'bg-swish-500' : 'bg-neutral-300'}`} />)}</div>
          <CarouselBtn onClick={() => setI(i + 1)}>›</CarouselBtn>
        </div>
      )}
    </div>
  );
}

function CarouselBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="grid h-6 w-6 place-items-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-100">{children}</button>;
}

function ListShell({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-4">
      <button onClick={onBack} className="mb-2 text-xs font-medium text-swish-600 hover:underline">← Back</button>
      <h2 className="mb-3 text-base font-semibold text-neutral-800">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ThreadView({ id, onBack, onReopen }: { id: string; onBack: () => void; onReopen: () => void }) {
  const [data, setData] = useState<{ conversation: Conversation; messages: Message[] } | null>(null);
  useEffect(() => {
    api.conversation(id).then((d) => setData({ conversation: d.conversation, messages: d.messages })).catch(() => {});
  }, [id]);
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={onBack} className="text-xs font-medium text-swish-600 hover:underline">← Conversations</button>
        {data && <span className="text-xs text-neutral-400">{data.conversation.subject} · {data.conversation.id.replace('cnv_', '#')}</span>}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3">
        {data?.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-swish-500 text-white' : m.role === 'agent' ? 'bg-amber-100 text-amber-900' : 'bg-neutral-100 text-neutral-800'}`}>{m.text}</div>
          </div>
        ))}
        {data && data.messages.length === 0 && <Empty>No messages.</Empty>}
      </div>
      <button onClick={onReopen} className="mt-3 w-full rounded-lg border border-swish-300 bg-swish-50 py-2 text-sm font-medium text-swish-700 hover:bg-swish-100">Reopen this conversation</button>
    </div>
  );
}
