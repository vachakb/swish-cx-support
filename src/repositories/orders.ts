import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { id } from '../db/ids';
import { orderItems, orderTracking, orders } from '../db/schema';

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderTracking = typeof orderTracking.$inferSelect;

export interface OrderDetails {
  order: Order;
  items: OrderItem[];
  tracking: OrderTracking | undefined;
}

export const getOrder = (oid: string) => db.select().from(orders).where(eq(orders.id, oid)).get();

export const getTracking = (orderId: string) =>
  db.select().from(orderTracking).where(eq(orderTracking.orderId, orderId)).get();

export async function getOrderDetails(oid: string): Promise<OrderDetails | undefined> {
  const order = await getOrder(oid);
  if (!order) return undefined;
  const [items, tracking] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, oid)).all(),
    getTracking(oid),
  ]);
  return { order, items, tracking };
}

export const listOrdersByCustomer = (customerId: string) =>
  db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.placedAt)).all();

export interface NewOrderInput {
  customerId: string;
  status?: Order['status'];
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  addressArea?: string;
  promisedInMin?: number; // can be negative to craft a breached order
  tracking?: {
    etaSeconds: number;
    etaAgeSec?: number;
    gpsAgeSec?: number;
    stateAgeSec?: number;
    stage?: OrderTracking['stage'];
    distanceRemainingM?: number;
  };
}

// Arena: create an order (+ items + optional live tracking) so evaluators can craft scenarios.
export async function createOrder(input: NewOrderInput): Promise<string> {
  const oid = id('ord');
  const now = Date.now();
  const subtotal = input.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  await db.insert(orders).values({
    id: oid,
    customerId: input.customerId,
    status: input.status ?? 'placed',
    placedAt: new Date(now),
    promisedBy: new Date(now + (input.promisedInMin ?? 10) * 60_000),
    podId: 'pod_demo',
    addressArea: input.addressArea ?? 'HSR Layout',
    subtotal,
    total: subtotal,
    paymentMethod: 'upi',
  });
  if (input.items.length > 0) {
    await db.insert(orderItems).values(input.items.map((it) => ({ id: id('oit'), orderId: oid, name: it.name, quantity: it.quantity, unitPrice: it.unitPrice })));
  }
  const t = input.tracking;
  if (t) {
    await db.insert(orderTracking).values({
      orderId: oid,
      etaSeconds: t.etaSeconds,
      etaLastComputedAt: new Date(now - (t.etaAgeSec ?? 10) * 1000),
      riderLastGpsAt: new Date(now - (t.gpsAgeSec ?? 10) * 1000),
      distanceRemainingM: t.distanceRemainingM ?? 800,
      stage: t.stage ?? 'enroute',
      stateLastTransitionAt: new Date(now - (t.stateAgeSec ?? 60) * 1000),
    });
  }
  return oid;
}
