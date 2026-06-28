import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import type { Customer, Message, Scenario, Trace } from '../types';
import { Chat } from './Chat';
import { ProfilePanel } from './ProfilePanel';
import type { ProfileDetail } from './ProfilePanel';
import { TracePanel } from './TracePanel';

type ImagePayload = { mimeType: string; dataBase64: string };

export function Arena() {
  const [profiles, setProfiles] = useState<Customer[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
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

  useEffect(() => {
    api.profiles().then(setProfiles).catch(() => {});
    api.scenarios().then(setScenarios).catch(() => {});
  }, []);

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
  }

  async function pickProfile(id: string) {
    resetThread();
    setOrderId(undefined);
    await loadProfile(id);
  }

  async function pickScenario(s: Scenario) {
    resetThread();
    setChannel(s.channel);
    setOrderId(s.orderId ?? undefined);
    setDraft(s.suggestedMessage);
    await loadProfile(s.customerId);
  }

  function appended(role: Message['role'], text: string): Message {
    return { id: crypto.randomUUID(), role, text, createdAt: '' };
  }

  async function send(text: string, image?: ImagePayload) {
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
        <ProfilePanel scenarios={scenarios} profiles={profiles} selectedId={profileId} detail={detail} onPickScenario={pickScenario} onPickProfile={pickProfile} />
      </aside>
      <section className="flex min-h-0 flex-col max-lg:h-[70vh]">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
          <div className="text-sm text-neutral-600">{detail ? <>Acting as <span className="font-medium text-neutral-800">{detail.customer.name}</span></> : 'Pick a profile or scenario'}</div>
          <div className="flex gap-1 text-xs">
            <ChannelBtn active={channel === 'web'} onClick={() => { setChannel('web'); resetThread(); }}>Web</ChannelBtn>
            <ChannelBtn active={channel === 'whatsapp'} onClick={() => { setChannel('whatsapp'); resetThread(); }}>WhatsApp</ChannelBtn>
          </div>
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

function ChannelBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded px-2 py-1 ${active ? 'bg-swish-100 text-swish-700' : 'text-neutral-500 hover:bg-neutral-100'}`}>
      {children}
    </button>
  );
}
