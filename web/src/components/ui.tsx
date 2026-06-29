import type { ReactNode } from 'react';

export function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text);
      }}
      className="text-neutral-400 hover:text-neutral-600"
      title="Copy"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
    </button>
  );
}

export function CheckCircle() {
  return <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-green-500 text-[10px] font-bold text-white">✓</span>;
}

export function RefundIcon() {
  return <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-neutral-600 text-xs font-bold text-neutral-700">₹</span>;
}

export function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <button type="button" onClick={onBack} className="text-2xl leading-none text-neutral-800">←</button>
      <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  delivered: 'text-green-600',
  resolved: 'text-green-600',
  closed: 'text-neutral-400',
  cancelled: 'text-neutral-400',
  escalated: 'text-amber-600',
  arriving: 'text-blue-600',
  dispatched: 'text-blue-600',
  preparing: 'text-amber-600',
  placed: 'text-amber-600',
};

export function StatusText({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  return <span className={`text-[15px] font-medium ${STATUS_TONE[status] ?? 'text-neutral-600'}`}>{label}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-2 text-sm text-neutral-400">{children}</div>;
}
