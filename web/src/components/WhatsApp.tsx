import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import { SUB_ISSUES, TOPIC_SENDS, composeIssueMessage, topicsForStatus } from '../intake';
import type { OrderWithItems } from '../types';
import { inr } from '../util';

interface Msg {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

type MenuStep = 'none' | 'pickOrder' | 'topLevel' | 'subIssue' | 'pickItems';
const shortId = (id: string) => id.slice(-6).toUpperCase();

// A generic help/greeting opens the guided menu; a specific complaint goes straight to the agent.
function isHelpTrigger(t: string): boolean {
  const s = t.trim();
  return s.length < 30 && /^(hi|hello|hey|help|need help|i need help|support|customer (care|support)|assist)/i.test(s);
}

// Showcases the real WhatsApp Cloud API integration: a phone-framed thread whose messages run through
// the actual webhook contract (Meta payload in → Graph API reply out), with both payloads shown.
// "I need help" opens guided options (order → issue → items), just like the in-app flow — in production
// these are WhatsApp interactive list/button messages; here they're rendered in the phone frame.
export function WhatsApp({ customerId }: { customerId?: string }) {
  const [phone, setPhone] = useState('919000011111');
  const [name, setName] = useState('You');
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [io, setIo] = useState<{ inbound: unknown; outbound: unknown; mode: string } | null>(null);
  const [step, setStep] = useState<MenuStep>('none');
  const [menuOrder, setMenuOrder] = useState<OrderWithItems | undefined>();
  const [menuIssue, setMenuIssue] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customerId) return;
    api.profile(customerId).then((d) => { setPhone(d.customer.phone.replace('+', '')); setName(d.customer.name); }).catch(() => {});
    api.orders(customerId).then(setOrders).catch(() => {});
  }, [customerId]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, sending, step]);

  const pushUser = (t: string) => setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: t }]);
  const pushBot = (t: string) => setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'bot', text: t }]);

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

  // The real webhook round-trip — used for free text and the guided menu's final composed message.
  async function webhookSend(body: string, echo: boolean, orderId?: string) {
    if (echo) pushUser(body);
    setSending(true);
    const payload = metaPayload(body);
    try {
      const res = await api.whatsapp(payload, orderId);
      pushBot(res.reply ?? '…');
      setIo({ inbound: payload, outbound: res.outbound, mode: res.mode ?? 'sim' });
    } catch {
      pushBot('(failed to reach webhook)');
    } finally {
      setSending(false);
    }
  }

  function onInputSend() {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    pushUser(body);
    if (isHelpTrigger(body) && orders.length > 0) {
      pushBot('Sure — which order do you need help with?');
      setStep('pickOrder');
    } else {
      void webhookSend(body, false);
    }
  }

  function pickOrder(o: OrderWithItems) {
    setMenuOrder(o);
    pushUser(`Order ${shortId(o.id)} · ${inr(o.total)}`);
    pushBot('How can I help with this order?');
    setStep('topLevel');
  }
  function pickTopic(id: string) {
    const label = (menuOrder ? topicsForStatus(menuOrder.status) : []).find((t) => t.id === id)?.label ?? id;
    pushUser(label);
    if (id === 'not_right') { pushBot("I'm sorry to hear that — what went wrong?"); setStep('subIssue'); return; }
    if (id === 'other_topic') { setStep('none'); pushBot("Sure — tell me what's up and I'll help."); return; }
    setStep('none');
    void webhookSend(TOPIC_SENDS[id] ?? label, false, menuOrder?.id);
  }
  function pickSubIssue(id: string) {
    const label = SUB_ISSUES.find((s) => s.id === id)?.label ?? id;
    pushUser(label);
    if (id === 'other') { setStep('none'); pushBot('No problem — tell me what happened and I’ll help.'); return; }
    setMenuIssue(id);
    pushBot('Which item(s) were affected?');
    setStep('pickItems');
  }
  function confirmItems(names: string[]) {
    pushUser(names.join(', '));
    setStep('none');
    void webhookSend(composeIssueMessage(menuIssue, names), false, menuOrder?.id);
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
          <div className="h-[400px] space-y-2 overflow-y-auto bg-[#e5ddd5] p-3">
            {messages.length === 0 && <div className="mt-8 text-center text-xs text-neutral-500">Say “I need help” to see Swish’s guided options, or describe your issue.</div>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 shadow-sm ${m.role === 'user' ? 'bg-[#dcf8c6]' : 'bg-white'}`}>{m.text}</div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {step === 'none' ? (
            <div className="flex items-center gap-2 bg-[#f0f0f0] p-2">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onInputSend(); }} placeholder="Message" className="flex-1 rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none" />
              <button type="button" onClick={onInputSend} disabled={sending || !text.trim()} className="grid h-9 w-9 place-items-center rounded-full bg-[#075e54] text-white disabled:opacity-40">➤</button>
            </div>
          ) : (
            <div className="max-h-[210px] space-y-1.5 overflow-y-auto bg-[#f0f0f0] p-2">
              {step === 'pickOrder' && orders.map((o) => (
                <WaButton key={o.id} onClick={() => pickOrder(o)}>{inr(o.total)} · {o.status} — {shortId(o.id)}</WaButton>
              ))}
              {step === 'topLevel' && menuOrder && topicsForStatus(menuOrder.status).map((t) => <WaButton key={t.id} onClick={() => pickTopic(t.id)}>{t.label}</WaButton>)}
              {step === 'subIssue' && SUB_ISSUES.map((s) => <WaButton key={s.id} onClick={() => pickSubIssue(s.id)}>{s.label}</WaButton>)}
              {step === 'pickItems' && menuOrder && <WaItemPicker items={menuOrder.items} onConfirm={confirmItems} />}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-neutral-900">WhatsApp Cloud API integration {io && <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">{io.mode} mode</span>}</h2>
          <p className="mt-1 text-sm text-neutral-500">Not a reskin — each message runs through the <span className="font-medium text-neutral-700">real</span> Cloud API contract: Meta's webhook payload into <code className="rounded bg-neutral-100 px-1">/api/whatsapp/webhook</code>, then the Graph API request we send to reply. The guided options map to WhatsApp interactive list/button messages.</p>
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

function WaButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-lg bg-white px-3 py-2 text-left text-sm font-medium text-[#075e54] shadow-sm hover:bg-neutral-50">
      {children}
    </button>
  );
}

function WaItemPicker({ items, onConfirm }: { items: OrderWithItems['items']; onConfirm: (names: string[]) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(name: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => {
          const on = sel.has(i.name);
          return (
            <button key={i.name} type="button" onClick={() => toggle(i.name)} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-[#075e54] bg-[#075e54] text-white' : 'border-neutral-300 bg-white text-neutral-700'}`}>
              {on ? '✓ ' : ''}
              {i.name}
            </button>
          );
        })}
      </div>
      <button type="button" disabled={sel.size === 0} onClick={() => onConfirm([...sel])} className="w-full rounded-lg bg-[#075e54] py-2 text-sm font-medium text-white disabled:opacity-40">
        Send
      </button>
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
