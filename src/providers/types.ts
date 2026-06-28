import type { Customer, Order, OrderDetails, OrderTracking, Wallet } from '../repositories';

// Read providers. Mock impls read the seeded DB; Swish swaps in adapters to its real services.
export interface OrdersProvider {
  getCustomer(id: string): Promise<Customer | undefined>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderDetails(id: string): Promise<OrderDetails | undefined>;
  listOrdersByCustomer(customerId: string): Promise<Order[]>;
}

export interface TrackingProvider {
  getTracking(orderId: string): Promise<OrderTracking | undefined>;
}

export interface WalletProvider {
  getWallet(customerId: string): Promise<Wallet | undefined>;
}

// Write side. Discriminated so each action carries exactly the fields it needs.
interface BaseAction {
  conversationId: string;
  customerId: string;
  reason: string;
  idempotencyKey: string;
}
export type ActionRequest =
  | (BaseAction & { type: 'refund'; orderId: string; amount: number })
  | (BaseAction & { type: 'credit'; amount: number; orderId?: string })
  | (BaseAction & { type: 'cancel'; orderId: string })
  | (BaseAction & { type: 'redeliver'; orderId: string })
  | (BaseAction & { type: 'reassign_rider'; orderId: string });

export interface ActionResult {
  status: 'executed' | 'duplicate' | 'failed';
  resolutionId?: string;
  message: string;
}

// The LLM never calls this directly — only the deterministic policy core does.
export interface ActionExecutor {
  execute(req: ActionRequest): Promise<ActionResult>;
}

export interface Providers {
  orders: OrdersProvider;
  tracking: TrackingProvider;
  wallet: WalletProvider;
  executor: ActionExecutor;
}
