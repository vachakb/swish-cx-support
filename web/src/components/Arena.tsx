import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ensureNotifyPermission, notify } from '../notify';
import type { Message, Trace } from '../types';
import { Chat } from './Chat';
import { TracePanel } from './TracePanel';

type ImagePayload = { mimeType: string; dataBase64: string };

interface ArenaProps {
  customerId?: string;
  channel: 'web' | 'whatsapp';
  active: boolean;
  resumeThreadId?: string;
  onResumed?: () => void;
  onBack?: () => void;
}

// The support chat for the current customer over one channel, with a live decision trace.
export function Arena({ customerId, channel, active, resumeThreadId, onResumed, onBack }: ArenaProps) {
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
    seenAgent.current = new Set();
  }

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

  function appended(role: Message['role'], text: string): Message {
    return { id: crypto.randomUUID(), role, text, createdAt: '' };
  }

  async function send(text: string, image?: ImagePayload) {
    void ensureNotifyPermission();
    setSending(true);
    setMessages((m) => [...m, appended('user', text)]);
    setDraft('');
    try {
      const { result, trace: t } = await api.chat({ conversationId, customerId, channel, text, image });
      setConversationId(result.conversationId);
      setTrace(t);
      setStatus(result.status);
      setMessages((m) => [...m, appended('assistant', result.reply)]);
    } catch {
      setMessages((m) => [...m, appended('assistant', 'Sorry — I had trouble reaching support just now. Please try again.')]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-[1fr_320px] max-lg:grid-cols-1 max-lg:overflow-y-auto">
      <section className="flex min-h-0 flex-col max-lg:h-[70vh]">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
          <div className="flex items-center gap-2">
            {onBack && <button type="button" onClick={onBack} className="text-lg leading-none text-neutral-700">←</button>}
            <span className="text-sm font-medium text-neutral-700">{channel === 'whatsapp' ? 'WhatsApp' : 'Support chat'}</span>
          </div>
          <button type="button" onClick={resetThread} className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50">+ New chat</button>
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
