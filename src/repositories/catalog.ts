import { db } from '../db/client';
import { serviceability } from '../db/schema';

export type Serviceability = typeof serviceability.$inferSelect;

export const listServiceability = () => db.select().from(serviceability).all();
