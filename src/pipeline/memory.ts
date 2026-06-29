import type { Providers } from '../providers/types';
import * as repo from '../repositories';

export interface UserMemory {
  tenureDays: number;
  orderCount: number;
  pastResolutions: number;
  recentClaims: number;
  creditBalance: number;
  summary: string;
}

const CLAIM = new Set(['refund', 'credit']);

// A compact "who is this customer" snapshot the resolution agent reasons with.
export async function buildUserMemory(customerId: string, providers: Providers): Promise<UserMemory> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [customer, orders, all, wallet] = await Promise.all([
    providers.orders.getCustomer(customerId),
    providers.orders.listOrdersByCustomer(customerId),
    repo.listResolutionsByCustomer(customerId),
    providers.wallet.getWallet(customerId),
  ]);
  const claims = all.filter((r) => CLAIM.has(r.type));
  const recentClaims = claims.filter((r) => new Date(r.createdAt) >= since).length;
  const tenureDays = customer?.accountAgeDays ?? 0;
  const trust =
    recentClaims >= 3 ? 'Unusually high recent claim rate — be fair but careful.' : tenureDays > 180 ? 'Long-standing, loyal customer.' : 'Relatively new account.';
  const summary = `${customer?.name ?? 'Customer'}: ${tenureDays}d tenure, ${orders.length} orders, ${claims.length} prior support resolutions (${recentClaims} in the last 7 days), ₹${Math.round((wallet?.creditBalance ?? 0) / 100)} Swish credit. ${trust}`;
  return { tenureDays, orderCount: orders.length, pastResolutions: claims.length, recentClaims, creditBalance: wallet?.creditBalance ?? 0, summary };
}
