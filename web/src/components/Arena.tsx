import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ensureNotifyPermission, notify } from '../notify';
import type { Message, OrderWithItems, Trace } from '../types';
import { Composer } from './Composer';
import { Intake } from './Intake';
import type { IntakeResult } from './Intake';
import { MessageList } from './MessageList';
import { TracePanel } from './TracePanel';

type ImagePayload = { mimeType: string; dataBase64: string };

// One open intent: a specific order, a generic chat, or a reopened thread. A fresh object per open.
export interface ChatTarget {
  orderId?: string;
  threadId?: string;
}

interface ArenaProps {
  customerId?: string;
  active: boolean;
  target: ChatTarget;
  restoreConversationId?: string;
  onConversation?: (id: string | undefined) => void;
  onBack?: () => void;
}

const localMsg = (role: Message['role'], text: string): Message => ({ id: crypto.randomUUID(), role, text, createdAt: '' });

export function Arena({ customerId, active, target, restoreConversationId, onConversation, onBack }: ArenaProps) {
  const [conversationId, setConversationId] = useState<string>();
  const [orderId, setOrderId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [status, setStatus] = useState<string>();
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'intake' | 'chat'>('intake');
  const [intakeSeq, setIntakeSeq] = useState(0);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const seenAgent = useRef<Set<string>>(new Set());
  const booted = useRef(false);

  // Load the customer's orders once — used by the order/item pickers.
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    api.orders(customerId).then((os) => { if (!cancelled) { setOrders(os); setOrdersLoaded(true); } }).catch(() => setOrdersLoaded(true));
    return () => { cancelled = true; };
  }, [customerId]);

  function resetThread() {
    setConversationId(undefined);
    setMessages([]);
    setTrace(null);
    setStatus(undefined);
    seenAgent.current = new Set();
  }

  function beginIntake(oid?: string) {
    resetThread();
    setOrderId(oid);
    setMode('intake');
    setIntakeSeq((n) => n + 1);
  }

  // Each open (Need Help / Chat / reopen) arrives as a fresh target object → re-initialise.
  useEffect(() => {
    if (!booted.current) {
      booted.current = true;
      if (restoreConversationId) { void loadThread(restoreConversationId); return; } // restore the active chat on refresh
    }
    if (target.threadId) void loadThread(target.threadId);
    else beginIntake(target.orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Report the active conversation up so it survives a page refresh.
  useEffect(() => {
    onConversation?.(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function loadThread(id: string) {
    try {
      const { conversation, messages: server } = await api.conversation(id);
      resetThread();
      setConversationId(conversation.id);
      setMessages(server.map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt })));
      seenAgent.current = new Set(server.filter((m) => m.role === 'agent').map((m) => m.id));
      setStatus(conversation.status);
      setMode('chat');
    } catch {
      /* ignore */
    }
  }

  // Poll for human (agent) replies; notify if the customer has left this view.
  useEffect(() => {
    if (!conversationId) return;
    const tick = async () => {
      try {
        const { messages: server } = await api.conversation(conversationId);
        const fresh = server.filter((m) => m.role === 'agent' && !seenAgent.current.has(m.id));
        if (fresh.length === 0) return;
        fresh.forEach((m) => seenAgent.current.add(m.id));
        setMessages((cur) => [...cur, ...fresh.map((m) => ({ id: m.id, role: 'agent' as const, text: m.text, createdAt: m.createdAt }))]);
        if (!active || document.hidden) notify('Swish Support', fresh[fresh.length - 1]!.text);
      } catch {
        /* ignore */
      }
    };
    const iv = setInterval(tick, 4000);
    return () => clearInterval(iv);
  }, [conversationId, active]);

  async function send(text: string, image?: ImagePayload, echo = true, oid = orderId) {
    void ensureNotifyPermission();
    setSending(true);
    if (echo) setMessages((m) => [...m, localMsg('user', text)]);
    try {
      const { result, trace: t } = await api.chat({ conversationId, customerId, orderId: oid, channel: 'web', text, image });
      setConversationId(result.conversationId);
      setTrace(t);
      setStatus(result.status);
      setMessages((m) => [...m, localMsg('assistant', result.reply)]);
    } catch {
      setMessages((m) => [...m, localMsg('assistant', 'Sorry — I had trouble reaching support just now. Please try again.')]);
    } finally {
      setSending(false);
    }
  }

  function onIntakeComplete(r: IntakeResult) {
    setMessages(r.bubbles);
    if (r.orderId) setOrderId(r.orderId);
    setMode('chat');
    if (r.send) void send(r.send, r.image, false, r.orderId ?? orderId);
  }

  const intakeOrder = orderId ? orders.find((o) => o.id === orderId) : undefined;
  const intakeWaiting = mode === 'intake' && orderId !== undefined && !ordersLoaded;

  return (
    <div className="grid h-full grid-cols-[1fr_320px] max-lg:grid-cols-1 max-lg:overflow-y-auto">
      <section className="flex min-h-0 flex-col bg-white max-lg:h-[75vh]">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            {onBack && <button type="button" onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100">←</button>}
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-swish-400 to-swish-600 text-white">★</span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-neutral-900">Swish Support</div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-swish-600"><span className="h-1.5 w-1.5 rounded-full bg-swish-500" /> Online</div>
            </div>
          </div>
          <button type="button" onClick={() => beginIntake(undefined)} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50">+ New chat</button>
        </div>

        {mode === 'intake' ? (
          intakeWaiting ? (
            <div className="grid flex-1 place-items-center text-sm text-neutral-400">Loading…</div>
          ) : (
            <Intake key={intakeSeq} order={intakeOrder} orders={orders} onComplete={onIntakeComplete} />
          )
        ) : (
          <>
            <MessageList messages={messages} sending={sending} channel="web" placeholder="Tell us what's up and we'll help." />
            <Composer sending={sending} onSend={(t, img) => void send(t, img)} />
          </>
        )}
      </section>
      <aside className="border-l border-neutral-100 bg-white/40 max-lg:border-t">
        <TracePanel trace={trace} status={status} />
      </aside>
    </div>
  );
}
