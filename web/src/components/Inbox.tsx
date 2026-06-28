import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Conversation } from '../types';

export function Inbox() {
  const [items, setItems] = useState<Conversation[]>([]);

  useEffect(() => {
    api.inbox().then(setItems).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-3 text-lg font-semibold text-neutral-800">Shared Inbox</h2>
      <p className="mb-4 text-sm text-neutral-500">Every channel lands here. Escalated conversations are where a human picks up — with the full context.</p>
      <div className="space-y-2">
        {items.length === 0 && <div className="text-sm text-neutral-400">No conversations yet — start one in the Play Arena.</div>}
        {items.map((c) => (
          <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-800">{c.subject ?? c.id}</span>
              <span className="text-xs text-neutral-500">{c.channel} · {c.status}</span>
            </div>
            {c.escalationReason && <div className="mt-1 text-xs text-amber-700">⚠ {c.escalationReason}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
