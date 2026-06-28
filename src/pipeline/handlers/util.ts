import type { Providers } from '../../providers/types';

const TERMINAL = new Set(['delivered', 'cancelled']);

export async function pickOrderId(
  providers: Providers,
  customerId: string | undefined,
  prefer: 'active' | 'delivered' | 'any',
): Promise<string | undefined> {
  if (!customerId) return undefined;
  const orders = await providers.orders.listOrdersByCustomer(customerId);
  if (orders.length === 0) return undefined;
  if (prefer === 'active') return (orders.find((o) => !TERMINAL.has(o.status)) ?? orders[0])?.id;
  if (prefer === 'delivered') return (orders.find((o) => o.status === 'delivered') ?? orders[0])?.id;
  return orders[0]?.id;
}
