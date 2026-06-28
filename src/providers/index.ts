import { mockExecutor } from './executor';
import { mockOrders, mockTracking, mockWallet } from './mock';
import type { Providers } from './types';

// Real Swish adapters (REST/JSON over their Go services) would be selected here when configured.
// The mock reads the seeded local DB so the whole engine runs offline.
export function createProviders(): Providers {
  return { orders: mockOrders, tracking: mockTracking, wallet: mockWallet, executor: mockExecutor };
}

export const providers = createProviders();
export type { ActionExecutor, ActionRequest, ActionResult, OrdersProvider, Providers, TrackingProvider, WalletProvider } from './types';
