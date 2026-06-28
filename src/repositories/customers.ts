import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { customers, wallets } from '../db/schema';

export type Customer = typeof customers.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;

export const getCustomer = (id: string) =>
  db.select().from(customers).where(eq(customers.id, id)).get();

export const getWallet = (customerId: string) =>
  db.select().from(wallets).where(eq(wallets.customerId, customerId)).get();
