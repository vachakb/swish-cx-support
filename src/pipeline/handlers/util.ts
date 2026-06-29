import { formatINR } from '../../core/money';
import type { Order } from '../../repositories';
import type { Providers } from '../../providers/types';
import type { Suggestion } from '../types';

// Selectable order chips (first item + total, carrying the orderId) — so "which order?" actually lets
// the customer pick one rather than the bot auto-guessing. Shared by the cancel and issue flows.
export async function orderChips(providers: Providers, orders: Order[], send: string): Promise<Suggestion[]> {
  const chips: Suggestion[] = [];
  for (const o of orders) {
    const details = await providers.orders.getOrderDetails(o.id);
    const items = details?.items ?? [];
    const first = items[0];
    const name = first ? `${first.name}${items.length > 1 ? ` +${items.length - 1}` : ''}` : 'Order';
    chips.push({ label: `${name} · ${formatINR(o.total)}`, send, orderId: o.id });
  }
  return chips;
}

const TERMINAL = new Set(['delivered', 'cancelled']);
const DELIVERING = new Set(['packed', 'dispatched', 'arriving']);
const CANCELLABLE = new Set(['placed', 'preparing']);

// Pick the most relevant order when the customer didn't name one:
// WISMO wants an out-for-delivery order, cancel wants a cancellable one, issues want a delivered one.
export async function pickOrderId(
  providers: Providers,
  customerId: string | undefined,
  prefer: 'delivering' | 'cancellable' | 'delivered' | 'active',
): Promise<string | undefined> {
  if (!customerId) return undefined;
  const orders = await providers.orders.listOrdersByCustomer(customerId);
  if (orders.length === 0) return undefined;
  const firstId = (match: (status: string) => boolean) => orders.find((o) => match(o.status))?.id;
  const active = () => firstId((s) => !TERMINAL.has(s));
  if (prefer === 'delivering') return firstId((s) => DELIVERING.has(s)) ?? active() ?? orders[0]?.id;
  if (prefer === 'cancellable') return firstId((s) => CANCELLABLE.has(s)) ?? active() ?? orders[0]?.id;
  if (prefer === 'delivered') return firstId((s) => s === 'delivered') ?? orders[0]?.id;
  return active() ?? orders[0]?.id;
}
