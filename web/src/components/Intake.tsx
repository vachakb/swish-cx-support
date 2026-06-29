import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Message, OrderWithItems } from '../types';
import { inr, longDate, readImageAsBase64 } from '../util';
import { SUB_ISSUES, TOPIC_SENDS, composeIssueMessage, orderItemNames, orderLabel, topicsForStatus } from '../intake';
import { MessageList } from './MessageList';

type ImagePayload = { mimeType: string; dataBase64: string };

let seq = 0;
const mk = (role: Message['role'], text: string, image?: string): Message => ({ id: `intake-${seq++}`, role, text, image, createdAt: '' });
const PHOTO_ISSUES = new Set(['spilled', 'quality', 'wrong']);

export interface IntakeResult {
  bubbles: Message[];
  send: string | null; // message to send to the agent, or null to drop into free chat
  orderId?: string;
  image?: ImagePayload;
}

type Step = 'pickOrder' | 'topLevel' | 'subIssue' | 'pickItems';

// Guided intake: disambiguates intent + gathers the affected items before free chat,
// matching Swish's Help flow and giving the resolution agent precise context up front.
export function Intake({ order, orders, onComplete }: { order?: OrderWithItems; orders: OrderWithItems[]; onComplete: (r: IntakeResult) => void }) {
  const [bubbles, setBubbles] = useState<Message[]>(() => [mk('assistant', order ? 'How can I help with this order?' : 'Which order do you need help with?')]);
  const [step, setStep] = useState<Step>(order ? 'topLevel' : 'pickOrder');
  const [chosen, setChosen] = useState<OrderWithItems | undefined>(order);
  const [issue, setIssue] = useState('');

  function pickOrder(o: OrderWithItems) {
    setChosen(o);
    setBubbles((b) => [...b, mk('user', `${orderLabel(o)} · ${inr(o.total)}`), mk('assistant', 'How can I help with this order?')]);
    setStep('topLevel');
  }

  const topics = topicsForStatus(chosen?.status ?? 'delivered');
  function topLevel(id: string) {
    const label = topics.find((t) => t.id === id)?.label ?? id;
    const next = [...bubbles, mk('user', label)];
    if (id === 'not_right') {
      setBubbles([...next, mk('assistant', "I'm sorry to hear that — what went wrong?")]);
      setStep('subIssue');
      return;
    }
    if (id === 'other_topic') {
      onComplete({ bubbles: [...next, mk('assistant', "Sure — tell me what's up and I'll help.")], send: null, orderId: chosen?.id });
      return;
    }
    onComplete({ bubbles: next, send: TOPIC_SENDS[id] ?? label, orderId: chosen?.id });
  }

  function subIssue(id: string) {
    const label = SUB_ISSUES.find((s) => s.id === id)?.label ?? id;
    const next = [...bubbles, mk('user', label)];
    if (id === 'other') {
      onComplete({ bubbles: [...next, mk('assistant', 'No problem — tell me what happened and I’ll help.')], send: null, orderId: chosen?.id });
      return;
    }
    setIssue(id);
    const prompt = PHOTO_ISSUES.has(id) ? 'Which item(s) were affected? A photo of the issue helps us sort it faster.' : 'Which item(s) were affected?';
    setBubbles([...next, mk('assistant', prompt)]);
    setStep('pickItems');
  }

  function confirmItems(names: string[], image?: ImagePayload) {
    const url = image ? `data:${image.mimeType};base64,${image.dataBase64}` : undefined;
    const next = [...bubbles, mk('user', names.join(', '), url)];
    onComplete({ bubbles: next, send: composeIssueMessage(issue, names), orderId: chosen?.id, image });
  }

  // No order to pick, or the question isn't order-related → drop into free chat for general help.
  function pickGeneral() {
    const next = [...bubbles, mk('user', "It's not about an order"), mk('assistant', 'No problem — what can I help you with? Ask about payments, your account, referrals, areas we deliver to, or anything else.')];
    onComplete({ bubbles: next, send: null, orderId: undefined });
  }

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={bubbles} channel="web" />
      <div className="border-t border-neutral-100 bg-white px-4 py-3">
        <div className="mx-auto w-full max-w-2xl">
          {step === 'pickOrder' && <OrderOptions orders={orders} onPick={pickOrder} onGeneral={pickGeneral} />}
          {step === 'topLevel' && <Chips options={topics} onPick={topLevel} />}
          {step === 'subIssue' && <Chips options={SUB_ISSUES} onPick={subIssue} />}
          {step === 'pickItems' && chosen && <ItemPicker items={chosen.items} onConfirm={confirmItems} />}
        </div>
      </div>
    </div>
  );
}

function Chips({ options, onPick }: { options: ReadonlyArray<{ id: string; label: string; icon?: string }>; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onPick(o.id)} className="flex items-center gap-2.5 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-left text-sm font-medium text-neutral-700 hover:border-swish-300 hover:bg-swish-50">
          {'icon' in o && o.icon && <span className="text-base">{o.icon}</span>}
          <span className="flex-1">{o.label}</span>
          <span className="text-neutral-300">›</span>
        </button>
      ))}
    </div>
  );
}

function OrderOptions({ orders, onPick, onGeneral }: { orders: OrderWithItems[]; onPick: (o: OrderWithItems) => void; onGeneral: () => void }) {
  return (
    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
      {orders.map((o) => (
        <button key={o.id} type="button" onClick={() => onPick(o)} className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-left transition hover:border-swish-300 hover:bg-swish-50">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-neutral-800">{orderItemNames(o)}</span>
            <span className="shrink-0 text-sm font-semibold text-neutral-800">{inr(o.total)}</span>
          </div>
          <div className="mt-0.5 text-xs capitalize text-neutral-400">{o.status} · {longDate(o.placedAt)}</div>
        </button>
      ))}
      <button type="button" onClick={onGeneral} className="rounded-xl border border-dashed border-neutral-300 px-3.5 py-2.5 text-left text-sm font-medium text-neutral-600 transition hover:border-swish-300 hover:bg-swish-50 hover:text-swish-700">
        💬 {orders.length === 0 ? 'Ask a general question' : "It's not about a specific order"}
      </button>
    </div>
  );
}

function ItemPicker({ items, onConfirm }: { items: OrderWithItems['items']; onConfirm: (names: string[], image?: ImagePayload) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [imageName, setImageName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle(name: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }
  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(await readImageAsBase64(file));
    setImageName(file.name);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {items.map((i) => {
          const on = sel.has(i.name);
          return (
            <button key={i.name} type="button" onClick={() => toggle(i.name)} className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-swish-500 bg-swish-500 text-white' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}>
              {on ? '✓ ' : ''}
              {i.name}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm font-medium text-swish-600 hover:text-swish-700">
          📷 {imageName ? `Photo: ${imageName}` : 'Add a photo (optional)'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
        <button type="button" disabled={sel.size === 0} onClick={() => onConfirm([...sel], image ?? undefined)} className="rounded-lg bg-swish-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          Continue
        </button>
      </div>
    </div>
  );
}
