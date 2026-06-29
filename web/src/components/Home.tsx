import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import type { Conversation, Customer, FaqArticle, FaqCategory, Message, OrderWithItems, Refund, Wallet } from '../types';
import { formatId, inr, shortDateTime } from '../util';
import { Faq } from './Faq';
import { OrderCard } from './OrderCard';
import { CopyBtn, Empty, RefundIcon, SubHeader } from './ui';

interface HomeProps {
  customerId?: string;
  onOpenChat: (orderId?: string) => void;
  onResumeThread: (id: string) => void;
}

type View = 'home' | 'refunds' | 'threads' | 'orders' | 'topic' | 'article' | 'thread';

export function Home({ customerId, onOpenChat, onResumeThread }: HomeProps) {
  const [detail, setDetail] = useState<{ customer: Customer; wallet: Wallet | null } | null>(null);
  const [refunds, setRefunds] = useState<{ refunds: Refund[]; activeCount: number }>({ refunds: [], activeCount: 0 });
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [faq, setFaq] = useState<FaqCategory[]>([]);
  const [view, setView] = useState<View>('home');
  const [topic, setTopic] = useState<FaqCategory>();
  const [article, setArticle] = useState<FaqArticle>();
  const [threadId, setThreadId] = useState<string>();
  const [threadReturn, setThreadReturn] = useState<View>('home');

  const reload = useCallback(() => {
    if (!customerId) return;
    api.profile(customerId).then((d) => setDetail({ customer: d.customer, wallet: d.wallet })).catch(() => {});
    api.refunds(customerId).then(setRefunds).catch(() => {});
    api.threads(customerId).then(setThreads).catch(() => {});
    api.orders(customerId).then(setOrders).catch(() => {});
  }, [customerId]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { api.faq().then(setFaq).catch(() => {}); }, []);

  function openThread(id: string, from: View) {
    setThreadId(id);
    setThreadReturn(from);
    setView('thread');
  }

  if (view === 'topic' && topic) {
    return (
      <Panel>
        <SubHeader title={topic.title} onBack={() => setView('home')} />
        <div className="rounded-2xl border border-neutral-200 bg-white px-4">
          {topic.articles.map((a, i) => (
            <button key={a.id} type="button" onClick={() => { setArticle(a); setView('article'); }} className={`flex w-full items-start justify-between gap-3 py-3.5 text-left ${i > 0 ? 'border-t border-neutral-100' : ''}`}>
              <span className="text-[15px] font-semibold text-neutral-700">{a.question}</span>
              <span className="mt-0.5 text-lg text-neutral-300">›</span>
            </button>
          ))}
        </div>
      </Panel>
    );
  }

  if (view === 'article' && topic && article) {
    return (
      <Panel>
        <SubHeader title={topic.title} onBack={() => setView('topic')} />
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-bold text-neutral-900">{article.question}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{article.answer}</p>
          <button type="button" onClick={() => onOpenChat()} className="mt-4 text-sm font-semibold text-swish-600">Still need help? Chat with us →</button>
        </div>
      </Panel>
    );
  }

  if (view === 'thread' && threadId) return <ThreadView id={threadId} onBack={() => setView(threadReturn)} onReopen={() => onResumeThread(threadId)} />;

  if (view === 'refunds') {
    return (
      <Panel>
        <SubHeader title="Refunds & credits" onBack={() => setView('home')} />
        <div className="space-y-2.5">{refunds.refunds.length === 0 ? <Empty>No refunds yet.</Empty> : refunds.refunds.map((r) => <RefundRow key={r.id} r={r} />)}</div>
      </Panel>
    );
  }

  if (view === 'threads') {
    return (
      <Panel>
        <SubHeader title="Conversation archives" onBack={() => setView('home')} />
        <div className="space-y-2.5">{threads.length === 0 ? <Empty>No conversations yet.</Empty> : threads.map((t) => <ArchiveCard key={t.id} t={t} onOpen={() => openThread(t.id, 'threads')} />)}</div>
      </Panel>
    );
  }

  if (view === 'orders') {
    return (
      <Panel>
        <SubHeader title="Order History" onBack={() => setView('home')} />
        <div className="space-y-3">{orders.length === 0 ? <Empty>No orders yet.</Empty> : orders.map((o) => <OrderCard key={o.id} order={o} variant="history" onNeedHelp={() => onOpenChat(o.id)} />)}</div>
      </Panel>
    );
  }

  const latest = threads[0];
  return (
    <Panel>
      <h1 className="mb-4 text-2xl font-bold text-neutral-900">Help</h1>

      <button type="button" onClick={() => setView('refunds')} className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-4">
        <span className="flex items-center gap-3">
          <RefundIcon />
          <span className="text-[15px] text-neutral-700">Active refunds : {refunds.activeCount}</span>
        </span>
        <span className="text-[15px] text-neutral-700">View all →</span>
      </button>

      <SectionHeader title="Conversation archives" onViewAll={threads.length ? () => setView('threads') : undefined} />
      {latest ? <ArchiveCard t={latest} onOpen={() => openThread(latest.id, 'home')} /> : <CardEmpty>No conversations yet — start a chat below.</CardEmpty>}

      <SectionHeader title="Recent Orders" onViewAll={orders.length ? () => setView('orders') : undefined} />
      {orders.length === 0 ? <CardEmpty>No orders yet.</CardEmpty> : <OrderCarousel orders={orders.slice(0, 3)} onNeedHelp={onOpenChat} />}

      <h2 className="mb-2 mt-6 text-2xl font-bold text-neutral-900">All Help Topics</h2>
      <div className="rounded-2xl border border-neutral-200 bg-white px-4">
        <Faq categories={faq} onPick={(c) => { setTopic(c); setView('topic'); }} />
      </div>

      <button type="button" onClick={() => onOpenChat()} className="mt-5 w-full rounded-xl bg-swish-500 py-3 text-sm font-semibold text-white hover:bg-swish-600">Chat with support</button>
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="mx-auto h-full max-w-xl overflow-y-auto p-4">{children}</div>;
}

function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between">
      <h2 className="text-base font-bold text-neutral-900">{title}</h2>
      {onViewAll && <button type="button" onClick={onViewAll} className="text-sm font-medium text-neutral-700 underline-offset-2 hover:underline">View All</button>}
    </div>
  );
}

function CardEmpty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-400">{children}</div>;
}

function RefundRow({ r }: { r: Refund }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <div>
        <div className="text-[15px] font-semibold text-neutral-800">{r.type === 'credit' ? 'Swish credit' : 'Refund'} · {r.amount != null ? inr(r.amount) : '—'}</div>
        <div className="mt-0.5 text-sm text-neutral-500">{r.reason}</div>
      </div>
      <span className={`text-sm font-medium ${r.status === 'processing' ? 'text-amber-600' : 'text-green-600'}`}>{r.status}</span>
    </div>
  );
}

function ArchiveCard({ t, onOpen }: { t: Conversation; onOpen: () => void }) {
  const open = t.status === 'bot' || t.status === 'awaiting_user' || t.status === 'escalated';
  return (
    <div onClick={onOpen} className="cursor-pointer rounded-2xl border border-neutral-200 bg-white px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-semibold text-neutral-800">{t.subject ?? 'Conversation'}</span>
        <span className="text-sm font-semibold text-swish-600">{open ? 'Active' : 'View'}</span>
      </div>
      {open ? (
        <div className="mt-1 flex items-center justify-between text-sm text-neutral-500">
          <span className="flex items-center gap-1.5">ID: {formatId(t.id)} <CopyBtn text={formatId(t.id)} /></span>
          <span>{shortDateTime(t.updatedAt)}</span>
        </div>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">ID: {formatId(t.id)} <CopyBtn text={formatId(t.id)} /></div>
          <div className="mt-2 border-t border-dashed border-neutral-200 pt-2 text-sm text-neutral-500">
            <div>Opened on: {shortDateTime(t.createdAt)}</div>
            <div className="mt-0.5">Closed on: {shortDateTime(t.updatedAt)}</div>
          </div>
        </>
      )}
    </div>
  );
}

function OrderCarousel({ orders, onNeedHelp }: { orders: OrderWithItems[]; onNeedHelp: (id: string) => void }) {
  const [i, setI] = useState(0);
  const len = orders.length;
  const idx = ((i % len) + len) % len;
  return (
    <div>
      <OrderCard order={orders[idx]!} variant="home" onNeedHelp={() => onNeedHelp(orders[idx]!.id)} />
      {len > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-3">
          <button type="button" onClick={() => setI(i - 1)} className="text-neutral-400">‹</button>
          <div className="flex items-center gap-1.5">{orders.map((o, d) => <span key={o.id} className={`h-1.5 rounded-full ${d === idx ? 'w-4 bg-swish-500' : 'w-1.5 bg-neutral-300'}`} />)}</div>
          <button type="button" onClick={() => setI(i + 1)} className="text-neutral-400">›</button>
        </div>
      )}
    </div>
  );
}

function ThreadView({ id, onBack, onReopen }: { id: string; onBack: () => void; onReopen: () => void }) {
  const [data, setData] = useState<{ conversation: Conversation; messages: Message[] } | null>(null);
  useEffect(() => {
    api.conversation(id).then((d) => setData({ conversation: d.conversation, messages: d.messages })).catch(() => {});
  }, [id]);
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col p-4">
      <SubHeader title={data?.conversation.subject ?? 'Conversation'} onBack={onBack} />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-3">
        {data?.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-swish-500 text-white' : m.role === 'agent' ? 'bg-amber-100 text-amber-900' : 'bg-neutral-100 text-neutral-800'}`}>{m.text}</div>
          </div>
        ))}
        {data && data.messages.length === 0 && <Empty>No messages.</Empty>}
      </div>
      <button type="button" onClick={onReopen} className="mt-3 w-full rounded-xl border border-swish-300 bg-swish-50 py-2.5 text-sm font-semibold text-swish-700 hover:bg-swish-100">Reopen conversation</button>
    </div>
  );
}
