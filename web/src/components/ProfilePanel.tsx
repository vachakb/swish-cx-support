import { useState } from 'react';
import type { Customer, Order, Scenario, Wallet } from '../types';
import { inr } from '../util';

export type OrderPreset = 'stuck' | 'healthy' | 'delivered';

export interface ProfileDetail {
  customer: Customer;
  wallet: Wallet | null;
  orders: Order[];
}

interface Props {
  scenarios: Scenario[];
  profiles: Customer[];
  selectedId?: string;
  detail: ProfileDetail | null;
  onPickScenario: (s: Scenario) => void;
  onPickProfile: (id: string) => void;
  onCreateProfile: (name: string, area: string) => void;
  onCreateOrder: (preset: OrderPreset) => void;
}

export function ProfilePanel({ scenarios, profiles, selectedId, detail, onPickScenario, onPickProfile, onCreateProfile, onCreateOrder }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('HSR Layout');

  function submit() {
    if (!name.trim()) return;
    onCreateProfile(name.trim(), area.trim() || 'HSR Layout');
    setName('');
    setShowForm(false);
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Scenarios</h3>
        <div className="space-y-2">
          {scenarios.map((s) => (
            <button key={s.id} onClick={() => onPickScenario(s)} className="block w-full rounded-lg border border-neutral-200 bg-white p-2.5 text-left hover:border-swish-200 hover:bg-swish-50">
              <div className="text-sm font-medium text-neutral-800">{s.title}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{s.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Profiles</h3>
          <button onClick={() => setShowForm((v) => !v)} className="text-xs font-medium text-swish-600 hover:underline">{showForm ? 'cancel' : '+ new'}</button>
        </div>
        {showForm && (
          <div className="mb-2 space-y-1.5 rounded-lg border border-neutral-200 bg-white p-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded border border-neutral-200 px-2 py-1 text-sm focus:border-swish-400 focus:outline-none" />
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area" className="w-full rounded border border-neutral-200 px-2 py-1 text-sm focus:border-swish-400 focus:outline-none" />
            <button onClick={submit} className="w-full rounded bg-swish-500 px-2 py-1 text-sm font-medium text-white">Create profile</button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => onPickProfile(p.id)}
              className={`rounded-full border px-2.5 py-1 text-xs ${selectedId === p.id ? 'border-swish-400 bg-swish-50 text-swish-700' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      {detail && (
        <section className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="text-sm font-semibold text-neutral-800">{detail.customer.name}</div>
          <div className="text-xs text-neutral-500">{detail.customer.area} · account {detail.customer.accountAgeDays}d old</div>
          {detail.wallet && (
            <div className="mt-2 text-xs text-neutral-600">
              Swish credit: <span className="font-medium">{inr(detail.wallet.creditBalance)}</span> · Referral pending: <span className="font-medium">{inr(detail.wallet.referralRewardPending)}</span>
            </div>
          )}
          <div className="mt-2 space-y-1">
            {detail.orders.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded bg-neutral-50 px-2 py-1 text-xs">
                <span className="text-neutral-400">{o.id.replace('ord_', '#')}</span>
                <span className="font-medium text-neutral-700">{o.status}</span>
                <span className="text-neutral-500">{inr(o.total)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Add an order</div>
            <div className="flex gap-1.5">
              <OrderBtn onClick={() => onCreateOrder('stuck')}>Stuck</OrderBtn>
              <OrderBtn onClick={() => onCreateOrder('healthy')}>Healthy</OrderBtn>
              <OrderBtn onClick={() => onCreateOrder('delivered')}>Delivered</OrderBtn>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function OrderBtn({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} className="flex-1 rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600 hover:border-swish-300 hover:bg-swish-50">
      {children}
    </button>
  );
}
