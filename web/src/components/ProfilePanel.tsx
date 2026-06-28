import type { Customer, Order, Scenario, Wallet } from '../types';
import { inr } from '../util';

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
}

export function ProfilePanel({ scenarios, profiles, selectedId, detail, onPickScenario, onPickProfile }: Props) {
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
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Profiles</h3>
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
        </section>
      )}
    </div>
  );
}
