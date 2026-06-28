import * as repo from '../repositories';
import type { Providers } from '../providers/types';
import { policyConfig } from './config';

export interface RiskSignals {
  accountAgeDays: number;
  recentClaims: number;
  lifetimeClaimCount: number;
  lifetimeOrderCount: number;
  lifetimeRefundRatio: number;
}

const CLAIM_TYPES = new Set(['refund', 'credit']);

export async function computeRiskSignals(customerId: string, providers: Providers): Promise<RiskSignals> {
  const since = new Date(Date.now() - policyConfig.velocityWindowDays * 86_400_000);
  const [customer, recent, all, orders] = await Promise.all([
    providers.orders.getCustomer(customerId),
    repo.listResolutionsByCustomer(customerId, since),
    repo.listResolutionsByCustomer(customerId),
    providers.orders.listOrdersByCustomer(customerId),
  ]);
  const recentClaims = recent.filter((r) => CLAIM_TYPES.has(r.type)).length;
  const lifetimeClaimCount = all.filter((r) => CLAIM_TYPES.has(r.type)).length;
  const lifetimeOrderCount = orders.length;
  return {
    accountAgeDays: customer?.accountAgeDays ?? 0,
    recentClaims,
    lifetimeClaimCount,
    lifetimeOrderCount,
    lifetimeRefundRatio: lifetimeOrderCount ? lifetimeClaimCount / lifetimeOrderCount : 0,
  };
}
