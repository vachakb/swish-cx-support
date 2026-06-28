import { useState } from 'react';
import type { ReactNode } from 'react';
import { Arena } from './components/Arena';
import { Inbox } from './components/Inbox';

type View = 'arena' | 'inbox';

export default function App() {
  const [view, setView] = useState<View>('arena');
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-swish-500 font-bold text-white">S</span>
          <div>
            <div className="text-sm font-semibold leading-none text-neutral-900">Swish Support Copilot</div>
            <div className="mt-0.5 text-xs text-neutral-500">10-minute food delivery · automated CX</div>
          </div>
        </div>
        <nav className="flex gap-1 text-sm">
          <Tab active={view === 'arena'} onClick={() => setView('arena')}>Play Arena</Tab>
          <Tab active={view === 'inbox'} onClick={() => setView('inbox')}>Shared Inbox</Tab>
        </nav>
      </header>
      {/* Both views stay mounted so the arena keeps polling and can notify while you're in the inbox. */}
      <main className="min-h-0 flex-1">
        <div className={view === 'arena' ? 'h-full' : 'hidden'}>
          <Arena active={view === 'arena'} />
        </div>
        <div className={view === 'inbox' ? 'h-full' : 'hidden'}>
          <Inbox active={view === 'inbox'} />
        </div>
      </main>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1.5 font-medium ${active ? 'bg-swish-50 text-swish-700' : 'text-neutral-600 hover:bg-neutral-100'}`}>
      {children}
    </button>
  );
}
