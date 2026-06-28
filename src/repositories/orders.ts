import { desc, eq } from 'drizzle-orm';
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

export const getOrder = (id: string) =>
  db.select().from(orders).where(eq(orders.id, id)).get();

export const getTracking = (orderId: string) =>
  db.select().from(orderTracking).where(eq(orderTracking.orderId, orderId)).get();

export async function getOrderDetails(id: string): Promise<OrderDetails | undefined> {
  const order = await getOrder(id);
  if (!order) return undefined;
  const [items, tracking] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).all(),
    db.select().from(orderTracking).where(eq(orderTracking.orderId, id)).get(),
  ]);
  return { order, items, tracking };
}

export const listOrdersByCustomer = (customerId: string) =>
  db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.placedAt)).all();
