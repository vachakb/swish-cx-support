import { useState } from 'react';
import type { FaqArticle, FaqCategory } from '../types';

const ICONS: Record<string, string> = {
  delivery: '🛵',
  refunds: '💸',
  referrals: '🎁',
  serviceability: '📍',
  payments: '💳',
};

// Topic-first FAQ: a grid of topics; clicking one opens that topic's articles.
export function Faq({ categories, onNeedChat }: { categories: FaqCategory[]; onNeedChat: () => void }) {
  const [topic, setTopic] = useState<FaqCategory | null>(null);

  if (topic) {
    return (
      <div className="space-y-2">
        <button onClick={() => setTopic(null)} className="text-xs font-medium text-swish-600 hover:underline">← All topics</button>
        <h4 className="text-sm font-semibold text-neutral-800">{ICONS[topic.id] ?? '❓'} {topic.title}</h4>
        <div className="space-y-1.5">
          {topic.articles.map((a) => (
            <Article key={a.id} article={a} />
          ))}
        </div>
        <button onClick={onNeedChat} className="text-xs font-medium text-swish-600 hover:underline">Still need help? Chat with us →</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {categories.map((cat) => (
        <button key={cat.id} onClick={() => setTopic(cat)} className="rounded-xl border border-neutral-200 bg-white p-3 text-left transition hover:border-swish-300 hover:bg-swish-50">
          <div className="text-xl">{ICONS[cat.id] ?? '❓'}</div>
          <div className="mt-1 text-sm font-medium text-neutral-800">{cat.title}</div>
          <div className="text-xs text-neutral-400">{cat.articles.length} articles</div>
        </button>
      ))}
    </div>
  );
}

function Article({ article }: { article: FaqArticle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium text-neutral-800">
        <span>{article.question}</span>
        <span className="text-neutral-400">{open ? '–' : '+'}</span>
      </button>
      {open && <div className="border-t border-neutral-100 p-3 text-sm leading-relaxed text-neutral-600">{article.answer}</div>}
    </div>
  );
}
