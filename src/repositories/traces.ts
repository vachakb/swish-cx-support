import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { traces } from '../db/schema';

export type Trace = typeof traces.$inferSelect;

export const getTrace = (tid: string) => db.select().from(traces).where(eq(traces.id, tid)).get();

export const listTracesByConversation = (conversationId: string) =>
  db.select().from(traces).where(eq(traces.conversationId, conversationId)).orderBy(desc(traces.createdAt)).all();
