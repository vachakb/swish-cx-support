import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import type { Conversation, Customer, FaqArticle, FaqCategory, OrderWithItems, Refund, Wallet } from '../types';
import { formatId, inr, shortDateTime } from '../util';
import { OrderCard } from './OrderCard';
import { CopyBtn, SubHeader } from './ui';

interface HomeProps {
  customerId?: string;
  onOpenChat: (orderId?: string) => void;
  onResumeThread: (id: string) => void;
}
type View = 'home' | 'refunds' | 'threads' | 'orders' | 'topic' | 'article';

const TOPIC_ICON: Record<string, string> = { delivery: '🛵', payments: '👛', changes: '🛍️', account: '🧑', support: '🛡️' };

export function Home({ customerId, onOpenChat, onResumeThread }: HomeProps) {
  const [detail, setDetail] = useState<{ customer: Customer; wallet: Wallet | null } | null>(null);
  const [refunds, setRefunds] = useState<{ refunds: Refund[]; activeCount: number }>({ refunds: [], activeCount: 0 });
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [faq, setFaq] = useState<FaqCategory[]>([]);
  const [view, setView] = useState<View>('home');
  const [topic, setTopic] = useState<FaqCategory>();
  const [article, setArticle] = useState<FaqArticle>();

  const reload = useCallback(() => {
    if (!customerId) return;
    api.profile(customerId).then((d) => setDetail({ customer: d.customer, wallet: d.wallet })).catch(() => {});
    api.refunds(customerId).then(setRefunds).catch(() => {});
    api.threads(customerId).then(setThreads).catch(() => {});
    api.orders(customerId).then(setOrders).catch(() => {});
  }, [customerId]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { api.faq().then(setFaq).catch(() => {}); }, []);

  if (view === 'topic' && topic) {
    return (
      <Shell narrow>
        <SubHeader title={topic.title} onBack={() => setView('home')} />
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          {topic.articles.map((a, i) => (
            <button key={a.id} type="button" onClick={() => { setArticle(a); setView('article'); }} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50 ${i > 0 ? 'border-t border-neutral-100' : ''}`}>
              <span className="text-[15px] font-medium text-neutral-700">{a.question}</span>
              <span className="text-lg text-neutral-300">›</span>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  if (view === 'article' && topic && article) {
    return (
      <Shell narrow>
        <SubHeader title={topic.title} onBack={() => setView('topic')} />
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold text-neutral-900">{article.question}</h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-neutral-600">{article.answer}</p>
          <button type="button" onClick={() => onOpenChat()} className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-swish-50 px-4 py-2 text-sm font-semibold text-swish-700 transition hover:bg-swish-100">Still need help? Chat with us →</button>
        </div>
      </Shell>
    );
  }


  if (view === 'refunds') {
    return (
      <Shell narrow>
        <SubHeader title="Refunds & credits" onBack={() => setView('home')} />
        <div className="space-y-3">{refunds.refunds.length === 0 ? <EmptyCard>No refunds yet.</EmptyCard> : refunds.refunds.map((r) => <RefundRow key={r.id} r={r} />)}</div>
      </Shell>
    );
  }

  if (view === 'threads') {
    return (
      <Shell narrow>
        <SubHeader title="Conversation archives" onBack={() => setView('home')} />
        <div className="space-y-3">{threads.length === 0 ? <EmptyCard>No conversations yet.</EmptyCard> : threads.map((t) => <ArchiveCard key={t.id} t={t} detailed onOpen={() => onResumeThread(t.id)} />)}</div>
      </Shell>
    );
  }

  if (view === 'orders') {
    return (
      <Shell narrow>
        <SubHeader title="Order history" onBack={() => setView('home')} />
        <div className="grid gap-4 sm:grid-cols-2">{orders.length === 0 ? <EmptyCard>No orders yet.</EmptyCard> : orders.map((o) => <OrderCard key={o.id} order={o} variant="history" onNeedHelp={() => onOpenChat(o.id)} />)}</div>
      </Shell>
    );
  }

  const firstName = detail?.customer.name?.split(' ')[0] ?? 'there';
  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">Hi {firstName} 👋</h1>
        <p className="mt-1 text-[15px] text-neutral-500">How can we help you today?</p>
      </div>

      <button type="button" onClick={() => setView('refunds')} className="group mb-6 flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-card ring-1 ring-swish-100 transition hover:shadow-soft">
        <span className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-swish-50 text-swish-600"><RefundGlyph /></span>
          <span className="text-left">
            <span className="block text-[15px] font-semibold text-neutral-900">Active refunds</span>
            <span className="block text-sm text-neutral-500">{refunds.activeCount} {refunds.activeCount === 1 ? 'refund' : 'refunds'} in progress</span>
          </span>
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-swish-700">View all <span className="transition group-hover:translate-x-0.5">→</span></span>
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeader title="Recent orders" onViewAll={orders.length ? () => setView('orders') : undefined} />
          {orders.length === 0 ? <EmptyCard>No orders yet.</EmptyCard> : (
            <div className="grid gap-4 sm:grid-cols-2">{orders.slice(0, 2).map((o) => <OrderCard key={o.id} order={o} variant="home" onNeedHelp={() => onOpenChat(o.id)} />)}</div>
          )}
        </section>
        <section>
          <SectionHeader title="Conversations" onViewAll={threads.length ? () => setView('threads') : undefined} />
          {threads.length === 0 ? <EmptyCard>No conversations yet.</EmptyCard> : (
            <div className="space-y-3">{threads.slice(0, 3).map((t) => <ArchiveCard key={t.id} t={t} onOpen={() => onResumeThread(t.id)} />)}</div>
          )}
        </section>
      </div>

      <h2 className="mb-3 mt-9 text-lg font-bold text-neutral-900">How can we help?</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {faq.map((cat) => <TopicCard key={cat.id} cat={cat} onPick={() => { setTopic(cat); setView('topic'); }} />)}
      </div>

      <button type="button" onClick={() => onOpenChat()} className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-swish-500 to-swish-600 py-3.5 text-[15px] font-semibold text-white shadow-card transition hover:shadow-soft">
        <span>💬</span> Chat with support
      </button>
    </Shell>
  );
}

function Shell({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <div className={`mx-auto h-full w-full overflow-y-auto px-4 py-6 sm:px-6 ${narrow ? 'max-w-2xl' : 'max-w-5xl'}`}>{children}</div>;
}

function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-bold text-neutral-900">{title}</h2>
      {onViewAll && <button type="button" onClick={onViewAll} className="text-sm font-semibold text-swish-700 hover:text-swish-800">View all →</button>}
    </div>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-white px-4 py-7 text-center text-sm text-neutral-400 shadow-card">{children}</div>;
}

function RefundGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <text x="13" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="700" stroke="none" fill="currentColor">₹</text>
    </svg>
  );
}

function TopicCard({ cat, onPick }: { cat: FaqCategory; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-swish-50 text-xl">{TOPIC_ICON[cat.id] ?? '❓'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-900">{cat.title}</span>
        <span className="block text-xs text-neutral-400">{cat.articles.length} {cat.articles.length === 1 ? 'article' : 'articles'}</span>
      </span>
      <span className="text-neutral-300">›</span>
    </button>
  );
}

function ArchiveCard({ t, onOpen, detailed }: { t: Conversation; onOpen: () => void; detailed?: boolean }) {
  const open = t.status === 'bot' || t.status === 'awaiting_user' || t.status === 'escalated';
  return (
    <div onClick={onOpen} className="cursor-pointer rounded-2xl bg-white px-4 py-3.5 shadow-card transition hover:shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-900">{t.subject ?? 'Conversation'}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${open ? 'bg-swish-50 text-swish-700' : 'bg-neutral-100 text-neutral-500'}`}>{open ? 'Active' : 'Closed'}</span>
      </div>
      {detailed ? (
        <div className="mt-2 space-y-0.5 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">ID: {formatId(t.id)} <CopyBtn text={formatId(t.id)} /></div>
          <div>Opened {shortDateTime(t.createdAt)}{!open && ` · Closed ${shortDateTime(t.updatedAt)}`}</div>
        </div>
      ) : (
        <div className="mt-1.5 text-xs text-neutral-400">{shortDateTime(t.updatedAt)}</div>
      )}
    </div>
  );
}

function RefundRow({ r }: { r: Refund }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-swish-50 text-swish-600"><RefundGlyph /></span>
        <div>
          <div className="text-sm font-semibold text-neutral-900">{r.type === 'credit' ? 'Swish credit' : 'Refund'} · {r.amount != null ? inr(r.amount) : '—'}</div>
          <div className="text-xs text-neutral-400">{r.reason}</div>
        </div>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === 'processing' ? 'bg-amber-50 text-amber-700' : 'bg-swish-50 text-swish-700'}`}>{r.status}</span>
    </div>
  );
}
