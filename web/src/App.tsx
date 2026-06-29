import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { Arena } from './components/Arena';
import { Home } from './components/Home';
import { Inbox } from './components/Inbox';
import type { Customer } from './types';

type View = 'home' | 'arena' | 'whatsapp' | 'inbox';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [profiles, setProfiles] = useState<Customer[]>([]);
  const [userId, setUserId] = useState<string>();
  const [resumeThreadId, setResumeThreadId] = useState<string>();

  async function refreshProfiles(select?: string) {
    const p = await api.profiles().catch(() => []);
    setProfiles(p);
    setUserId((cur) => select ?? cur ?? p[0]?.id);
  }
  useEffect(() => {
    void refreshProfiles();
  }, []);

  async function newProfile() {
    const name = window.prompt('New profile name?')?.trim();
    if (!name) return;
    try {
      const c = await api.createProfile({ name });
      await refreshProfiles(c.id);
    } catch {
      /* ignore */
    }
  }

  function resume(id: string) {
    setResumeThreadId(id);
    setView('arena');
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-swish-500 text-white">★</span>
          <div>
            <div className="text-sm font-semibold leading-none text-neutral-900">Swish Support</div>
            <div className="mt-0.5 text-xs text-neutral-500">10-minute food delivery</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-400">Acting as</span>
            <select value={userId ?? ''} onChange={(e) => setUserId(e.target.value)} className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700">
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button onClick={newProfile} className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-50" title="New profile">+</button>
          </div>
          <nav className="flex gap-1 text-sm">
            <Tab active={view === 'home'} onClick={() => setView('home')}>Home</Tab>
            <Tab active={view === 'arena'} onClick={() => setView('arena')}>Play Arena</Tab>
            <Tab active={view === 'whatsapp'} onClick={() => setView('whatsapp')}>WhatsApp</Tab>
            <Tab active={view === 'inbox'} onClick={() => setView('inbox')}>Shared Inbox</Tab>
          </nav>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {/* Home + Inbox remount on open (fresh data); the chat views stay mounted so notifications keep working. */}
        {view === 'home' && <Home customerId={userId} onOpenChat={() => setView('arena')} onResumeThread={resume} />}
        <div className={view === 'arena' ? 'h-full' : 'hidden'}>
          <Arena customerId={userId} channel="web" active={view === 'arena'} resumeThreadId={resumeThreadId} onResumed={() => setResumeThreadId(undefined)} />
        </div>
        <div className={view === 'whatsapp' ? 'h-full' : 'hidden'}>
          <Arena customerId={userId} channel="whatsapp" active={view === 'whatsapp'} />
        </div>
        {view === 'inbox' && <Inbox active />}
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
