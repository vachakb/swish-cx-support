import type { Customer, Order, Wallet } from '../types';
import { inr } from '../util';

export type OrderPreset = 'stuck' | 'healthy' | 'delivered';

export interface ProfileDetail {
  customer: Customer;
  wallet: Wallet | null;
  orders: Order[];
}

interface Props {
  detail: ProfileDetail | null;
  onCreateOrder: (preset: OrderPreset) => void;
  onNewChat: () => void;
}

// Slim session panel for the chat playground: new-chat, current-user context, demo-order presets.
export function ProfilePanel({ detail, onCreateOrder, onNewChat }: Props) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <button onClick={onNewChat} className="w-full rounded-lg bg-swish-500 py-2 text-sm font-medium text-white hover:bg-swish-600">+ New chat</button>

      {detail && (
        <section className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="text-sm font-semibold text-neutral-800">{detail.customer.name}</div>
          <div className="text-xs text-neutral-500">{detail.customer.area} · account {detail.customer.accountAgeDays}d old</div>
          {detail.wallet && (
            <div className="mt-2 text-xs text-neutral-600">
              Credit: <span className="font-medium">{inr(detail.wallet.creditBalance)}</span> · Referral pending: <span className="font-medium">{inr(detail.wallet.referralRewardPending)}</span>
            </div>
          )}
          <div className="mt-2 space-y-1">
            {detail.orders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded bg-neutral-50 px-2 py-1 text-xs">
                <span className="text-neutral-400">{o.id.replace('ord_', '#')}</span>
                <span className="font-medium text-neutral-700">{o.status}</span>
                <span className="text-neutral-500">{inr(o.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Add a demo order</div>
        <div className="flex gap-1.5">
          <OrderBtn onClick={() => onCreateOrder('stuck')}>Stuck</OrderBtn>
          <OrderBtn onClick={() => onCreateOrder('healthy')}>Healthy</OrderBtn>
          <OrderBtn onClick={() => onCreateOrder('delivered')}>Delivered</OrderBtn>
        </div>
      </section>
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
