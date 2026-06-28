import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { id } from '../db/ids';
import { customers, wallets } from '../db/schema';

export type Customer = typeof customers.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;

export const getCustomer = (cid: string) => db.select().from(customers).where(eq(customers.id, cid)).get();
export const getCustomerByPhone = (phone: string) => db.select().from(customers).where(eq(customers.phone, phone)).get();
export const listCustomers = () => db.select().from(customers).all();
export const getWallet = (customerId: string) => db.select().from(wallets).where(eq(wallets.customerId, customerId)).get();

export interface NewProfile {
  name: string;
  phone?: string;
  city?: string;
  area?: string;
  accountAgeDays?: number;
}

// Arena: create a test profile (customer + an empty wallet).
export async function createProfile(input: NewProfile): Promise<Customer> {
  const cid = id('cust');
  const phone = input.phone ?? `+9190${String(Date.now()).slice(-8)}`;
  await db.insert(customers).values({
    id: cid,
    name: input.name,
    phone,
    city: input.city ?? 'Bengaluru',
    area: input.area ?? 'HSR Layout',
    accountAgeDays: input.accountAgeDays ?? 30,
  });
  const code = `${input.name.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'SWISH'}150`;
  await db.insert(wallets).values({ customerId: cid, referralCode: code });
  return (await getCustomer(cid))!;
}
