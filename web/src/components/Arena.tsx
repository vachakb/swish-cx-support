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
  onAgentReply?: (text: string) => void;
  onBack?: () => void;
}

const localMsg = (role: Message['role'], text: string, image?: string): Message => ({ id: crypto.randomUUID(), role, text, image, createdAt: '' });

export function Arena({ customerId, active, target, restoreConversationId, onConversation, onAgentReply, onBack }: ArenaProps) {
  const [conversationId, setConversationId] = useState<string>();
  const [orderId, setOrderId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [status, setStatus] = useState<string>();
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [mode, setMode] = useState<'intake' | 'chat'>('intake');
  const [intakeSeq, setIntakeSeq] = useState(0);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const seenPushed = useRef<Set<string>>(new Set());
  const booted = useRef(false);
  const onAgentReplyRef = useRef(onAgentReply);
  onAgentReplyRef.current = onAgentReply;
  const activeRef = useRef(active);
  activeRef.current = active;

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
    setSuggestions([]);
    seenPushed.current = new Set();
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
      seenPushed.current = new Set(server.map((m) => m.id)); // everything already loaded is "seen"
      setStatus(conversation.status);
      setMode('chat');
    } catch {
      /* ignore */
    }
  }

  // Append a server-pushed message once (a human agent's reply, or an auto-close sign-off), and
  // notify if the customer has left this view.
  function ingestPushed(m: { id: string; role: Message['role']; text: string; createdAt: string }) {
    if (seenPushed.current.has(m.id)) return;
    seenPushed.current.add(m.id);
    setMessages((cur) => [...cur, { id: m.id, role: m.role, text: m.text, createdAt: m.createdAt }]);
    if (!activeRef.current || document.hidden) notify('Swish Support', m.text);
    onAgentReplyRef.current?.(m.text);
  }

  // Primary path: a live SSE stream delivers an agent reply (or the auto-close note) the instant it's sent.
  useEffect(() => {
    if (!conversationId) return;
    const es = new EventSource(`/api/conversations/${conversationId}/events`);
    es.addEventListener('message', (e) => {
      try {
        const m = JSON.parse(e.data) as { id: string; role: Message['role']; text: string; createdAt: string; payload?: { kind?: string } | null };
        if (m.role !== 'user') ingestPushed(m);
        if (m.payload?.kind === 'inactivity_close') setStatus('closed'); // surface the reopen banner live
      } catch {
        /* ignore a malformed frame */
      }
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Backstop: a slow poll covers the rare case the SSE stream can't connect (e.g. a buffering proxy).
  useEffect(() => {
    if (!conversationId) return;
    const tick = async () => {
      try {
        const { messages: server } = await api.conversation(conversationId);
        server.filter((m) => m.role === 'agent').forEach(ingestPushed);
      } catch {
        /* ignore */
      }
    };
    const iv = setInterval(tick, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function send(text: string, image?: ImagePayload, echo = true, oid = orderId, intake?: { role: 'user' | 'assistant'; text: string }[]) {
    void ensureNotifyPermission();
    setSending(true);
    setSuggestions([]);
    if (echo) setMessages((m) => [...m, localMsg('user', text, image ? `data:${image.mimeType};base64,${image.dataBase64}` : undefined)]);
    try {
      const { result, trace: t } = await api.chat({ conversationId, customerId, orderId: oid, channel: 'web', text, image, intake });
      setConversationId(result.conversationId);
      setTrace(t);
      setStatus(result.status);
      setSuggestions(result.suggestions ?? []);
      setMessages((m) => [...m, localMsg('assistant', result.reply)]);
      // If the customer left the chat before the reply landed, surface it like any other Swish reply.
      if (!activeRef.current || document.hidden) { notify('Swish Support', result.reply); onAgentReplyRef.current?.(result.reply); }
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
    if (r.send) {
      // Persist the chip transcript so reopening shows the full guided flow, not just the final exchange.
      const intake = r.bubbles.map((b) => ({ role: b.role === 'assistant' ? ('assistant' as const) : ('user' as const), text: b.text }));
      void send(r.send, r.image, false, r.orderId ?? orderId, intake);
    }
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
            {suggestions.length > 0 && (
              <div className="border-t border-neutral-100 bg-white px-4 py-2.5">
                <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-swish-200 bg-swish-50 px-3.5 py-1.5 text-sm font-medium text-swish-700 transition hover:bg-swish-100">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {(status === 'closed' || status === 'resolved') && (
              <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-700">This conversation was closed — send a message to reopen it.</div>
            )}
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
