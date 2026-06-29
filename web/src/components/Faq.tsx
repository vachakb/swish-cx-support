import type { FaqCategory } from '../types';

const ICONS: Record<string, string> = {
  delivery: '🛵',
  payments: '👛',
  changes: '🛍️',
  account: '🧑',
  support: '🛡️',
};

// The "All Help Topics" list: icon + title + chevron rows, matching Swish's Help screen.
export function Faq({ categories, onPick }: { categories: FaqCategory[]; onPick: (c: FaqCategory) => void }) {
  return (
    <div>
      {categories.map((cat, i) => (
        <button key={cat.id} type="button" onClick={() => onPick(cat)} className={`flex w-full items-center gap-3 py-3.5 text-left ${i > 0 ? 'border-t border-neutral-100' : ''}`}>
          <span className="text-2xl">{ICONS[cat.id] ?? '❓'}</span>
          <span className="flex-1 text-[15px] font-semibold text-neutral-800">{cat.title}</span>
          <span className="text-lg text-neutral-300">›</span>
        </button>
      ))}
    </div>
  );
}
