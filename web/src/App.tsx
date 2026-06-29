import { useEffect, useState } from 'react';
import { api } from './api';
import { Arena } from './components/Arena';
import type { ChatTarget } from './components/Arena';
import { Home } from './components/Home';
import { Inbox } from './components/Inbox';
import { WhatsApp } from './components/WhatsApp';

type View = 'home' | 'chat' | 'whatsapp' | 'inbox';
const TABS: { id: View; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'inbox', label: 'Shared Inbox' },
];

const SESSION_KEY = 'swish.session.v1';
function loadSession(): { view?: View; target?: ChatTarget; convId?: string } {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export default function App() {
  const [view, setView] = useState<View>(() => loadSession().view ?? 'home');
  const [userId, setUserId] = useState<string>();
  const [userName, setUserName] = useState('');
  const [target, setTarget] = useState<ChatTarget>(() => loadSession().target ?? {});
  const [chatConvId, setChatConvId] = useState<string | undefined>(() => loadSession().convId);

  useEffect(() => {
    api.profiles().then((p) => { setUserId(p[0]?.id); setUserName(p[0]?.name ?? ''); }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ view, target, convId: chatConvId }));
    } catch {
      /* ignore */
    }
  }, [view, target, chatConvId]);

  function openChat(orderId?: string) {
    setTarget({ orderId });
    setView('chat');
  }
  function resume(id: string) {
    setTarget({ threadId: id });
    setView('chat');
  }

  const activeTab: View = view === 'chat' ? 'home' : view;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-swish-50 via-neutral-50 to-neutral-100">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-neutral-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-swish-400 to-swish-600 text-lg text-white shadow-sm">★</span>
          <div className="leading-none">
            <div className="text-[15px] font-bold text-neutral-900">Swish Support</div>
            <div className="mt-1 text-[11px] font-medium text-neutral-400">10-minute food delivery</div>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-full bg-neutral-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition sm:px-4 ${activeTab === t.id ? 'bg-white text-swish-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {userName && <span className="hidden text-sm font-medium text-neutral-600 lg:block">{userName}</span>}
          <span className="grid h-9 w-9 place-items-center rounded-full bg-swish-100 text-sm font-bold text-swish-700">{userName ? userName[0] : '·'}</span>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {view === 'home' && <Home customerId={userId} onOpenChat={openChat} onResumeThread={resume} />}
        {/* The chat stays mounted so it keeps polling and can notify while you're elsewhere. */}
        <div className={view === 'chat' ? 'h-full' : 'hidden'}>
          <Arena customerId={userId} active={view === 'chat'} target={target} restoreConversationId={chatConvId} onConversation={setChatConvId} onBack={() => setView('home')} />
        </div>
        {view === 'whatsapp' && <WhatsApp customerId={userId} />}
        {view === 'inbox' && <Inbox active />}
      </main>
    </div>
  );
}
