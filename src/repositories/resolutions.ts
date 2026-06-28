import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/client';
import { id } from '../db/ids';
import { auditLog, resolutions } from '../db/schema';

export type Resolution = typeof resolutions.$inferSelect;
export type NewResolution = typeof resolutions.$inferInsert;

// Idempotent: the unique idempotencyKey guarantees a refund/credit executes at most once,
// even under retries. A duplicate insert is a no-op and returns the original row.
export async function createResolution(input: Omit<NewResolution, 'id'>): Promise<Resolution> {
  const row = { id: id('res'), ...input };
  await db.insert(resolutions).values(row).onConflictDoNothing({ target: resolutions.idempotencyKey });
  return (await db.select().from(resolutions).where(eq(resolutions.idempotencyKey, input.idempotencyKey)).get())!;
}

export const getResolutionByKey = (idempotencyKey: string) =>
  db.select().from(resolutions).where(eq(resolutions.idempotencyKey, idempotencyKey)).get();

export async function updateResolution(rid: string, patch: Partial<NewResolution>): Promise<void> {
  await db.update(resolutions).set({ ...patch, updatedAt: new Date() }).where(eq(resolutions.id, rid));
}

// Feeds the fraud signals (claim velocity, lifetime ratio).
export const listResolutionsByCustomer = (customerId: string, since?: Date) =>
  db.select().from(resolutions)
    .where(since ? and(eq(resolutions.customerId, customerId), gte(resolutions.createdAt, since)) : eq(resolutions.customerId, customerId))
    .orderBy(desc(resolutions.createdAt)).all();

export async function logAudit(input: Omit<typeof auditLog.$inferInsert, 'id'>): Promise<void> {
  await db.insert(auditLog).values({ id: id('aud'), ...input });
}
