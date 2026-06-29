import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface Msg {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

// Showcases the real WhatsApp Cloud API integration: a phone-framed thread whose messages run through
// the actual webhook contract (Meta payload in → Graph API reply out), with both payloads shown.
export function WhatsApp({ customerId }: { customerId?: string }) {
  const [phone, setPhone] = useState('919000011111');
  const [name, setName] = useState('You');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [io, setIo] = useState<{ inbound: unknown; outbound: unknown; mode: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customerId) return;
    api.profile(customerId).then((d) => { setPhone(d.customer.phone.replace('+', '')); setName(d.customer.name); }).catch(() => {});
  }, [customerId]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, sending]);

  function metaPayload(body: string) {
    return {
      object: 'whatsapp_business_account',
      entry: [{
        id: '<WABA_ID>',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550001234', phone_number_id: '<PHONE_NUMBER_ID>' },
            contacts: [{ profile: { name }, wa_id: phone }],
            messages: [{ from: phone, id: `wamid.${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body } }],
          },
        }],
      }],
    };
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: body }]);
    setSending(true);
    const payload = metaPayload(body);
    try {
      const res = await api.whatsapp(payload);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'bot', text: res.reply ?? '…' }]);
      setIo({ inbound: payload, outbound: res.outbound, mode: res.mode ?? 'sim' });
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'bot', text: '(failed to reach webhook)' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,400px)_1fr] gap-6 overflow-y-auto p-6 max-lg:grid-cols-1">
      <div className="mx-auto w-full max-w-[380px]">
        <div className="overflow-hidden rounded-[2rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-xl">
          <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
            <span className="text-lg leading-none">←</span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 font-bold">S</span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Swish</div>
              <div className="text-[11px] text-white/70">online</div>
            </div>
          </div>
          <div className="h-[440px] space-y-2 overflow-y-auto bg-[#e5ddd5] p-3">
            {messages.length === 0 && <div className="mt-8 text-center text-xs text-neutral-500">Text Swish as you would on WhatsApp.</div>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 shadow-sm ${m.role === 'user' ? 'bg-[#dcf8c6]' : 'bg-white'}`}>{m.text}</div>
              </div>
            ))}
            {sending && <div className="text-xs text-neutral-500">Swish is typing…</div>}
            <div ref={endRef} />
          </div>
          <div className="flex items-center gap-2 bg-[#f0f0f0] p-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Message" className="flex-1 rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none" />
            <button type="button" onClick={send} disabled={sending || !text.trim()} className="grid h-9 w-9 place-items-center rounded-full bg-[#075e54] text-white disabled:opacity-40">➤</button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-neutral-900">WhatsApp Cloud API integration {io && <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">{io.mode} mode</span>}</h2>
          <p className="mt-1 text-sm text-neutral-500">Not a reskin — each message runs through the <span className="font-medium text-neutral-700">real</span> Cloud API contract: Meta's webhook payload into <code className="rounded bg-neutral-100 px-1">/api/whatsapp/webhook</code>, then the Graph API request we send to reply.</p>
        </div>
        <CodeBlock title="① Inbound — what Meta POSTs to our webhook" json={io?.inbound} placeholder="Send a message to see the exact webhook payload our endpoint parses." />
        <CodeBlock title="② Outbound — the Graph API /messages call we send to reply" json={io?.outbound} placeholder="…and the exact request we'd POST back to Meta." />
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
          <span className="font-semibold text-neutral-700">Go live:</span> set <code>WHATSAPP_ACCESS_TOKEN</code> + <code>WHATSAPP_PHONE_NUMBER_ID</code> in <code>.env</code> and point Meta's webhook at <code>/api/whatsapp/webhook</code> (verify token <code>swish-verify</code>). No app-code changes — sends become real.
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ title, json, placeholder }: { title: string; json: unknown; placeholder: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-neutral-600">{title}</div>
      <pre className="max-h-60 overflow-auto rounded-lg bg-neutral-900 p-3 text-[11px] leading-relaxed text-green-300">
        {json ? JSON.stringify(json, null, 2) : <span className="text-neutral-500">{placeholder}</span>}
      </pre>
    </div>
  );
}
