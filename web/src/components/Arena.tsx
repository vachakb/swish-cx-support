import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ensureNotifyPermission, notify } from '../notify';
import type { Message, Trace } from '../types';
import { Chat } from './Chat';
import { ProfilePanel } from './ProfilePanel';
import type { OrderPreset, ProfileDetail } from './ProfilePanel';
import { TracePanel } from './TracePanel';

type ImagePayload = { mimeType: string; dataBase64: string };

const ORDER_PRESETS: Record<OrderPreset, unknown> = {
  stuck: { status: 'arriving', promisedInMin: -12, items: [{ name: 'Masala Chai', quantity: 2, unitPrice: 4000 }, { name: 'Veg Biryani', quantity: 1, unitPrice: 18000 }], tracking: { etaSeconds: 180, etaAgeSec: 1200, gpsAgeSec: 1200, stateAgeSec: 1200 } },
  healthy: { status: 'dispatched', promisedInMin: 6, items: [{ name: 'Paneer Roll', quantity: 2, unitPrice: 9000 }], tracking: { etaSeconds: 300, etaAgeSec: 15, gpsAgeSec: 8, stateAgeSec: 90 } },
  delivered: { status: 'delivered', promisedInMin: -50, items: [{ name: 'Filter Coffee', quantity: 1, unitPrice: 4000 }, { name: 'Masala Dosa', quantity: 1, unitPrice: 12000 }] },
};

interface ArenaProps {
  customerId?: string;
  channel: 'web' | 'whatsapp';
  active: boolean;
  resumeThreadId?: string;
  onResumed?: () => void;
}

export function Arena({ customerId, channel, active, resumeThreadId, onResumed }: ArenaProps) {
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [orderId, setOrderId] = useState<string>();
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [status, setStatus] = useState<string>();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const seenAgent = useRef<Set<string>>(new Set());

  function resetThread() {
    setConversationId(undefined);
    setMessages([]);
    setTrace(null);
    setStatus(undefined);
    setOrderId(undefined);
    seenAgent.current = new Set();
  }

  async function loadProfile(id: string) {
    try {
      setDetail(await api.profile(id));
    } catch {
      setDetail(null);
    }
  }

  // Current user changed → load their context and start a fresh thread.
  useEffect(() => {
    resetThread();
    if (customerId) void loadProfile(customerId);
  }, [customerId]);

  // Resume a reopened thread: load its messages and continue it.
  useEffect(() => {
    if (!resumeThreadId) return;
    void (async () => {
      try {
        const { conversation, messages: server } = await api.conversation(resumeThreadId);
        setConversationId(conversation.id);
        setMessages(server.map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt })));
        seenAgent.current = new Set(server.filter((m) => m.role === 'agent').map((m) => m.id));
        setTrace(null);
        setStatus(conversation.status);
      } catch {
        /* ignore */
      }
      onResumed?.();
    })();
  }, [resumeThreadId]);

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

  async function createOrder(preset: OrderPreset) {
    if (!customerId) return;
    try {
      await api.createOrder(customerId, ORDER_PRESETS[preset]);
      setOrderId(undefined);
      await loadProfile(customerId);
    } catch {
      /* ignore */
    }
  }

  function appended(role: Message['role'], text: string): Message {
    return { id: crypto.randomUUID(), role, text, createdAt: '' };
  }

  async function send(text: string, image?: ImagePayload) {
    void ensureNotifyPermission();
    setSending(true);
    setMessages((m) => [...m, appended('user', text)]);
    setDraft('');
    try {
      const { result, trace: t } = await api.chat({ conversationId, customerId, orderId, channel, text, image });
      setConversationId(result.conversationId);
      setTrace(t);
      setStatus(result.status);
      setMessages((m) => [...m, appended('assistant', result.reply)]);
      if (customerId) void loadProfile(customerId);
    } catch {
      setMessages((m) => [...m, appended('assistant', 'Sorry — I had trouble reaching support just now. Please try again.')]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-[280px_1fr_330px] max-lg:grid-cols-1 max-lg:overflow-y-auto">
      <aside className="border-r border-neutral-200 bg-white max-lg:border-b">
        <ProfilePanel detail={detail} onCreateOrder={createOrder} onNewChat={resetThread} />
      </aside>
      <section className="flex min-h-0 flex-col max-lg:h-[70vh]">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
          <div className="text-sm text-neutral-600">{detail ? <>Acting as <span className="font-medium text-neutral-800">{detail.customer.name}</span></> : 'Select a profile to start'}</div>
          <div className="text-xs text-neutral-400">{channel === 'whatsapp' ? 'WhatsApp channel' : 'In-app chat'}</div>
        </div>
        <div className="min-h-0 flex-1">
          <Chat messages={messages} sending={sending} channel={channel} draft={draft} onSend={send} />
        </div>
      </section>
      <aside className="border-l border-neutral-200 max-lg:border-t">
        <TracePanel trace={trace} status={status} />
      </aside>
    </div>
  );
}
