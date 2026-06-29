import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Conversation, Message, Trace } from '../types';

interface Detail {
  conversation: Conversation;
  messages: Message[];
  traces: Trace[];
}

export function Inbox({ active }: { active: boolean }) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const loadList = () => api.inbox().then(setItems).catch(() => {});
  useEffect(() => {
    if (active) loadList();
  }, [active]);

  async function open(id: string) {
    setSelectedId(id);
    try {
      setDetail(await api.conversation(id));
    } catch {
      setDetail(null);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    try {
      await api.agentReply(selectedId, reply.trim());
      setReply('');
      await open(selectedId);
      loadList();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-[340px_1fr] max-md:grid-cols-1">
      <aside className="overflow-y-auto border-r border-neutral-200 bg-white p-3">
        <h2 className="mb-1 text-sm font-semibold text-neutral-800">Shared Inbox</h2>
        <p className="mb-3 text-xs text-neutral-500">Every channel lands here; escalations are where a human picks up — with full context.</p>
        <div className="space-y-2">
          {items.length === 0 && <div className="text-sm text-neutral-400">No conversations yet — start one in the Arena.</div>}
          {items.map((c) => (
            <button
              key={c.id}
              onClick={() => open(c.id)}
              className={`block w-full rounded-xl bg-white p-3 text-left shadow-card transition ${selectedId === c.id ? 'ring-2 ring-swish-300' : 'hover:shadow-soft'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-neutral-900">{c.subject ?? c.id.replace('cnv_', '#')}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {c.status === 'escalated' && <TeamTag reason={c.escalationReason} />}
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium capitalize text-neutral-500">{c.channel}</span>
              </div>
              {c.escalationReason && <div className="mt-1.5 text-xs leading-snug text-neutral-400">{c.escalationReason}</div>}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        {!detail ? (
          <div className="grid flex-1 place-items-center text-sm text-neutral-400">Select a conversation.</div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {detail.messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'bg-white text-neutral-800 shadow-sm' : m.role === 'agent' ? 'bg-amber-100 text-amber-900' : 'bg-swish-500 text-white'}`}>
                    <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">{m.role}</div>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-200 bg-white p-3">
              <div className="mb-1 text-xs text-neutral-500">Reply as a human agent — the customer is notified even if they've left the chat.</div>
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                  placeholder="Type a reply…"
                  className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-swish-400 focus:outline-none"
                />
                <button onClick={sendReply} disabled={sending || !reply.trim()} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Send</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'escalated' ? 'bg-amber-100 text-amber-700' : status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{status}</span>;
}

// Which team an escalation routes to, derived from its reason — so the queue shows where each one is headed.
const TEAMS: { re: RegExp; label: string; cls: string }[] = [
  { re: /safety|conduct|misbehav|misconduct|rude|abusiv|harass|unsafe|hair|bug|insect|contaminat|foreign|sick|food.?pois|spoil|rotten/i, label: '🛡️ Safety review', cls: 'bg-red-50 text-red-700' },
  { re: /refund|payment|billing|charged|overcharg/i, label: '↺ Refund approval', cls: 'bg-swish-50 text-swish-700' },
  { re: /kitchen|missing|packed/i, label: '🍳 Kitchen check', cls: 'bg-amber-50 text-amber-700' },
  { re: /rider|tracking|late|dispatch|delayed|\beta\b|delivery/i, label: '🛵 Rider / dispatch', cls: 'bg-blue-50 text-blue-700' },
];
function TeamTag({ reason }: { reason?: string | null }) {
  const team = (reason && TEAMS.find((t) => t.re.test(reason))) || null;
  const { label, cls } = team ?? { label: '💬 Needs a teammate', cls: 'bg-neutral-100 text-neutral-600' };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}
