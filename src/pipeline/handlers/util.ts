import type { Providers } from '../../providers/types';

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
