import { useEffect, useRef } from 'react';
import type { Message } from '../types';

export function MessageList({ messages, sending, channel, placeholder }: { messages: Message[]; sending?: boolean; channel: 'web' | 'whatsapp'; placeholder?: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  const wa = channel === 'whatsapp';
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, sending]);
  return (
    <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto p-4 ${wa ? 'bg-[#e5ddd5]' : 'bg-neutral-50'}`}>
      {messages.length === 0 && placeholder && <div className="grid h-full place-items-center text-sm text-neutral-400">{placeholder}</div>}
      {messages.map((m) => (
        <Bubble key={m.id} message={m} wa={wa} />
      ))}
      {sending && <div className="text-xs text-neutral-400">Swish is typing…</div>}
      <div ref={endRef} />
    </div>
  );
}

function Bubble({ message, wa }: { message: Message; wa: boolean }) {
  const mine = message.role === 'user';
  const isAgent = message.role === 'agent';
  const tone = mine ? (wa ? 'bg-[#dcf8c6] text-neutral-900' : 'bg-swish-500 text-white') : isAgent ? 'bg-amber-100 text-amber-900' : 'bg-white text-neutral-800 shadow-sm';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${tone}`}>
        {isAgent && <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Human agent</div>}
        {message.text}
      </div>
    </div>
  );
}
