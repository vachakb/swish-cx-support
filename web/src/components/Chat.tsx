import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { Message } from '../types';
import { readImageAsBase64 } from '../util';

type ImagePayload = { mimeType: string; dataBase64: string };

interface ChatProps {
  messages: Message[];
  sending: boolean;
  channel: 'web' | 'whatsapp';
  draft: string;
  onSend: (text: string, image?: ImagePayload) => void;
}

export function Chat({ messages, sending, channel, draft, onSend }: ChatProps) {
  const [text, setText] = useState(draft);
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [imageName, setImageName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const wa = channel === 'whatsapp';

  useEffect(() => setText(draft), [draft]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, sending]);

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(await readImageAsBase64(file));
    setImageName(file.name);
  }

  function submit() {
    const t = text.trim();
    if (!t || sending) return;
    onSend(t, image ?? undefined);
    setText('');
    setImage(null);
    setImageName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className={`px-4 py-2 text-sm font-medium ${wa ? 'bg-[#075e54] text-white' : 'border-b border-neutral-200 bg-white text-neutral-700'}`}>
        {wa ? 'Swish on WhatsApp' : 'Chat with Swish Support'}
      </div>
      <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto p-4 ${wa ? 'bg-[#e5ddd5]' : 'bg-neutral-50'}`}>
        {messages.length === 0 && <div className="grid h-full place-items-center text-sm text-neutral-400">Pick a scenario, or say hello to start.</div>}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} wa={wa} />
        ))}
        {sending && <div className="text-xs text-neutral-400">Swish is typing…</div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-neutral-200 bg-white p-3">
        {imageName && <div className="mb-2 text-xs text-neutral-500">📎 {imageName}</div>}
        <div className="flex items-end gap-2">
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-500 hover:bg-neutral-50" title="Attach a photo">📷</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
          <textarea
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Type a message…"
            className="min-h-[40px] flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-swish-400 focus:outline-none"
          />
          <button onClick={submit} disabled={sending || !text.trim()} className="rounded-lg bg-swish-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            Send
          </button>
        </div>
      </div>
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
