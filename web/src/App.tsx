import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { Arena } from './components/Arena';
import type { ChatTarget } from './components/Arena';
import { Home } from './components/Home';
import { Inbox } from './components/Inbox';
import { WhatsApp } from './components/WhatsApp';

type View = 'home' | 'chat' | 'whatsapp' | 'inbox';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [userId, setUserId] = useState<string>();
  const [target, setTarget] = useState<ChatTarget>({});

  useEffect(() => {
    api.profiles().then((p) => setUserId(p[0]?.id)).catch(() => {});
  }, []);

  function openChat(orderId?: string) {
    setTarget({ orderId });
    setView('chat');
  }

  function resume(id: string) {
    setTarget({ threadId: id });
    setView('chat');
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-swish-500 text-white">★</span>
          <div>
            <div className="text-sm font-semibold leading-none text-neutral-900">Swish Support</div>
            <div className="mt-0.5 text-xs text-neutral-500">10-minute food delivery</div>
          </div>
        </div>
        <nav className="flex gap-1 text-sm">
          <Tab active={view === 'home' || view === 'chat'} onClick={() => setView('home')}>Home</Tab>
          <Tab active={view === 'whatsapp'} onClick={() => setView('whatsapp')}>WhatsApp</Tab>
          <Tab active={view === 'inbox'} onClick={() => setView('inbox')}>Shared Inbox</Tab>
        </nav>
      </header>

      <main className="min-h-0 flex-1">
        {view === 'home' && <Home customerId={userId} onOpenChat={openChat} onResumeThread={resume} />}
        {/* The chat stays mounted so it keeps polling and can notify while you're elsewhere. */}
        <div className={view === 'chat' ? 'h-full' : 'hidden'}>
          <Arena customerId={userId} active={view === 'chat'} target={target} onBack={() => setView('home')} />
        </div>
        {view === 'whatsapp' && <WhatsApp customerId={userId} />}
        {view === 'inbox' && <Inbox active />}
      </main>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 font-medium ${active ? 'bg-swish-50 text-swish-700' : 'text-neutral-600 hover:bg-neutral-100'}`}>
      {children}
    </button>
  );
}
