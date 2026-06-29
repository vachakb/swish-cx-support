import type { OrderWithItems } from '../types';
import { formatId, inr, longDate } from '../util';
import { CheckCircle, CopyBtn, StatusText } from './ui';

function itemsLine(o: OrderWithItems): string {
  return o.items.map((i) => `${i.name} x${i.quantity}`).join(', ') || '—';
}

// Mirrors Swish's order card. variant 'home' shows the ₹ + "Need Help?" row; 'history' leads with the
// amount and adds a "Rate order" row.
export function OrderCard({ order, variant, onNeedHelp }: { order: OrderWithItems; variant: 'home' | 'history'; onNeedHelp: () => void }) {
  const delivered = order.status === 'delivered';
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="p-4">
        <div className="flex items-start justify-between">
          {variant === 'history' ? <span className="text-lg font-bold text-swish-600">{inr(order.total)}</span> : <span className="text-[15px] font-semibold text-neutral-800">Order ID</span>}
          <span className="flex items-center gap-1.5">
            {delivered && <CheckCircle />}
            <StatusText status={order.status} />
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm text-neutral-500">
          <span className="flex items-center gap-1.5">ID: {formatId(order.id)} <CopyBtn text={formatId(order.id)} /></span>
          <span>{longDate(order.placedAt)}</span>
        </div>

        {variant === 'home' && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-bold text-neutral-900">{inr(order.total)}</span>
            <button type="button" onClick={onNeedHelp} className="text-[15px] font-semibold text-swish-600">Need Help?</button>
          </div>
        )}

        <div className="my-3 border-t border-dashed border-neutral-200" />
        <div className="text-sm leading-relaxed text-neutral-600">{itemsLine(order)}</div>

        {variant === 'history' && (
          <>
            <div className="my-3 border-t border-dashed border-neutral-200" />
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-neutral-800">Rate order</span>
              <div className="text-lg tracking-tight text-neutral-300">★★★★★</div>
            </div>
          </>
        )}
      </div>
      <button type="button" onClick={onNeedHelp} className="w-full bg-neutral-100 py-3 text-center text-[15px] font-semibold text-neutral-700 hover:bg-neutral-200">View details</button>
    </div>
  );
}
