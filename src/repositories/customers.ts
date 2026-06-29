import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { customers, wallets } from '../db/schema';

export type Customer = typeof customers.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;

export const getCustomer = (cid: string) => db.select().from(customers).where(eq(customers.id, cid)).get();
export const getCustomerByPhone = (phone: string) => db.select().from(customers).where(eq(customers.phone, phone)).get();
export const listCustomers = () => db.select().from(customers).all();
export const getWallet = (customerId: string) => db.select().from(wallets).where(eq(wallets.customerId, customerId)).get();

