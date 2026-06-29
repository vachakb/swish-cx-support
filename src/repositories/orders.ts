import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
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

// In-transit orders across all customers — scanned by the proactive late-order job.
export const listInTransitOrders = () =>
  db.select().from(orders).where(inArray(orders.status, ['packed', 'dispatched', 'arriving'])).all();

export type OrderWithItems = Order & { items: OrderItem[] };

export async function getOrdersWithItems(customerId: string): Promise<OrderWithItems[]> {
  const ords = await listOrdersByCustomer(customerId);
  if (ords.length === 0) return [];
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, ords.map((o) => o.id))).all();
  const byOrder = new Map<string, OrderItem[]>();
  for (const it of items) {
    const list = byOrder.get(it.orderId) ?? [];
    list.push(it);
    byOrder.set(it.orderId, list);
  }
  return ords.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
}

