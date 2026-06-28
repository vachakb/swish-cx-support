import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import { ensureNotifyPermission, notify } from '../notify';
import type { Customer, FaqCategory, Message, Trace } from '../types';
import { Chat } from './Chat';
import { Faq } from './Faq';
import { ProfilePanel } from './ProfilePanel';
import type { OrderPreset, ProfileDetail } from './ProfilePanel';
import { TracePanel } from './TracePanel';

type ImagePayload = { mimeType: string; dataBase64: string };

const ORDER_PRESETS: Record<OrderPreset, unknown> = {
  stuck: { status: 'arriving', promisedInMin: -12, items: [{ name: 'Masala Chai', quantity: 2, unitPrice: 4000 }, { name: 'Veg Biryani', quantity: 1, unitPrice: 18000 }], tracking: { etaSeconds: 180, etaAgeSec: 1200, gpsAgeSec: 1200, stateAgeSec: 1200 } },
  healthy: { status: 'dispatched', promisedInMin: 6, items: [{ name: 'Paneer Roll', quantity: 2, unitPrice: 9000 }], tracking: { etaSeconds: 300, etaAgeSec: 15, gpsAgeSec: 8, stateAgeSec: 90 } },
  delivered: { status: 'delivered', promisedInMin: -50, items: [{ name: 'Filter Coffee', quantity: 1, unitPrice: 4000 }, { name: 'Masala Dosa', quantity: 1, unitPrice: 12000 }] },
};

export function Arena({ active }: { active: boolean }) {
  const [profiles, setProfiles] = useState<Customer[]>([]);
  const [profileId, setProfileId] = useState<string>();
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [channel, setChannel] = useState<'web' | 'whatsapp'>('web');
  const [orderId, setOrderId] = useState<string>();
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [status, setStatus] = useState<string>();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'faq' | 'chat'>('faq'); // FAQ-first: self-serve, then chat
  const [faq, setFaq] = useState<FaqCategory[]>([]);
  const seenAgent = useRef<Set<string>>(new Set());

  const refreshProfiles = () => api.profiles().then(setProfiles).catch(() => {});
  useEffect(() => {
    refreshProfiles();
    api.faq().then(setFaq).catch(() => {});
  }, []);

  // Poll the open conversation for human (agent) replies; surface them — and notify if you've left the chat.
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
        /* ignore poll errors */
      }
    };
    const iv = setInterval(tick, 4000);
    return () => clearInterval(iv);
  }, [conversationId, active]);

  async function loadProfile(id: string) {
    setProfileId(id);
    try {
      setDetail(await api.profile(id));
    } catch {
      setDetail(null);
    }
  }

  function resetThread() {
    setConversationId(undefined);
    setMessages([]);
    setTrace(null);
    setStatus(undefined);
    seenAgent.current = new Set();
  }

  async function pickProfile(id: string) {
    resetThread();
    setOrderId(undefined);
    await loadProfile(id);
  }

  async function createProfile(name: string, area: string) {
    try {
      const c = await api.createProfile({ name, area });
      await refreshProfiles();
      resetThread();
      setOrderId(undefined);
      await loadProfile(c.id);
    } catch {
      /* ignore */
    }
  }

  async function createOrder(preset: OrderPreset) {
    if (!profileId) return;
    try {
      await api.createOrder(profileId, ORDER_PRESETS[preset]);
      setOrderId(undefined); // let the engine pick the newest matching order
      await loadProfile(profileId);
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
      const { result, trace: t } = await api.chat({ conversationId, customerId: profileId, orderId, channel, text, image });
      setConversationId(result.conversationId);
      setTrace(t);
      setStatus(result.status);
      setMessages((m) => [...m, appended('assistant', result.reply)]);
      if (profileId) void loadProfile(profileId);
    } catch {
      setMessages((m) => [...m, appended('assistant', 'Sorry — I had trouble reaching support just now. Please try again.')]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-[300px_1fr_330px] max-lg:grid-cols-1 max-lg:overflow-y-auto">
      <aside className="border-r border-neutral-200 bg-white max-lg:border-b">
        <ProfilePanel
          profiles={profiles}
          selectedId={profileId}
          detail={detail}
          onPickProfile={pickProfile}
          onCreateProfile={createProfile}
          onCreateOrder={createOrder}
        />
      </aside>
      <section className="flex min-h-0 flex-col max-lg:h-[70vh]">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
          <div className="text-sm text-neutral-600">{detail ? <>Acting as <span className="font-medium text-neutral-800">{detail.customer.name}</span></> : 'Pick a profile or scenario'}</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex gap-1">
              <ChannelBtn active={mode === 'faq'} onClick={() => setMode('faq')}>Help</ChannelBtn>
              <ChannelBtn active={mode === 'chat'} onClick={() => setMode('chat')}>Chat</ChannelBtn>
            </div>
            {mode === 'chat' && (
              <div className="flex gap-1 border-l border-neutral-200 pl-2">
                <ChannelBtn active={channel === 'web'} onClick={() => { setChannel('web'); resetThread(); }}>Web</ChannelBtn>
                <ChannelBtn active={channel === 'whatsapp'} onClick={() => { setChannel('whatsapp'); resetThread(); }}>WhatsApp</ChannelBtn>
              </div>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {mode === 'faq' ? <Faq categories={faq} onNeedChat={() => setMode('chat')} /> : <Chat messages={messages} sending={sending} channel={channel} draft={draft} onSend={send} />}
        </div>
      </section>
      <aside className="border-l border-neutral-200 max-lg:border-t">
        <TracePanel trace={trace} status={status} />
      </aside>
    </div>
  );
}

function ChannelBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded px-2 py-1 ${active ? 'bg-swish-100 text-swish-700' : 'text-neutral-500 hover:bg-neutral-100'}`}>
      {children}
    </button>
  );
}
