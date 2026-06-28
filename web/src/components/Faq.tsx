import { useState } from 'react';
import type { FaqCategory } from '../types';

// Self-serve Help module: customers find an answer here first; "still need help" hands off to chat.
export function Faq({ categories, onNeedChat }: { categories: FaqCategory[]; onNeedChat: () => void }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string>();
  const query = q.trim().toLowerCase();

  const filtered = categories
    .map((c) => ({ ...c, articles: c.articles.filter((a) => !query || `${a.question} ${a.answer} ${a.tags.join(' ')}`.toLowerCase().includes(query)) }))
    .filter((c) => c.articles.length > 0);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-neutral-800">How can we help?</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help…" className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-swish-400 focus:outline-none" />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {filtered.map((cat) => (
          <div key={cat.id}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{cat.title}</div>
            <div className="space-y-1.5">
              {cat.articles.map((a) => {
                const open = openId === a.id;
                return (
                  <div key={a.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    <button onClick={() => setOpenId(open ? undefined : a.id)} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium text-neutral-800">
                      <span>{a.question}</span>
                      <span className="text-neutral-400">{open ? '–' : '+'}</span>
                    </button>
                    {open && (
                      <div className="border-t border-neutral-100 p-3 text-sm leading-relaxed text-neutral-600">
                        {a.answer}
                        <button onClick={onNeedChat} className="mt-2 block text-xs font-medium text-swish-600 hover:underline">Still need help? Chat with us →</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-neutral-500">
            Nothing matched “{q}”.{' '}
            <button onClick={onNeedChat} className="font-medium text-swish-600 hover:underline">Chat with support →</button>
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 bg-white p-3">
        <button onClick={onNeedChat} className="w-full rounded-lg bg-swish-500 py-2 text-sm font-medium text-white hover:bg-swish-600">Chat with support</button>
      </div>
    </div>
  );
}
