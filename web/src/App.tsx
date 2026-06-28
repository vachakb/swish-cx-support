import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { Arena } from './components/Arena';
import { Faq } from './components/Faq';
import { Inbox } from './components/Inbox';
import type { FaqCategory } from './types';

type View = 'help' | 'arena' | 'whatsapp' | 'inbox';

export default function App() {
  const [view, setView] = useState<View>('help');
  const [faq, setFaq] = useState<FaqCategory[]>([]);

  useEffect(() => {
    api.faq().then(setFaq).catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-swish-500 text-white">★</span>
          <div>
            <div className="text-sm font-semibold leading-none text-neutral-900">Swish Support Copilot</div>
            <div className="mt-0.5 text-xs text-neutral-500">10-minute food delivery · automated CX</div>
          </div>
        </div>
        <nav className="flex gap-1 text-sm">
          <Tab active={view === 'help'} onClick={() => setView('help')}>Help</Tab>
          <Tab active={view === 'arena'} onClick={() => setView('arena')}>Play Arena</Tab>
          <Tab active={view === 'whatsapp'} onClick={() => setView('whatsapp')}>WhatsApp</Tab>
          <Tab active={view === 'inbox'} onClick={() => setView('inbox')}>Shared Inbox</Tab>
        </nav>
      </header>
      {/* Arena + WhatsApp stay mounted so they keep polling and can notify while you're elsewhere. */}
      <main className="min-h-0 flex-1">
        <div className={view === 'help' ? 'h-full bg-neutral-50' : 'hidden'}>
          <div className="mx-auto h-full max-w-2xl bg-white">
            <Faq categories={faq} onNeedChat={() => setView('arena')} />
          </div>
        </div>
        <div className={view === 'arena' ? 'h-full' : 'hidden'}>
          <Arena channel="web" active={view === 'arena'} />
        </div>
        <div className={view === 'whatsapp' ? 'h-full' : 'hidden'}>
          <Arena channel="whatsapp" active={view === 'whatsapp'} />
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
