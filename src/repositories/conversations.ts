import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { id } from '../db/ids';
import { attachments, conversations, messages } from '../db/schema';

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export const getConversation = (cid: string) =>
  db.select().from(conversations).where(eq(conversations.id, cid)).get();

export async function createConversation(input: Omit<NewConversation, 'id'>): Promise<Conversation> {
  const row = { id: id('cnv'), ...input };
  await db.insert(conversations).values(row);
  return (await getConversation(row.id))!;
}

export async function updateConversation(cid: string, patch: Partial<NewConversation>): Promise<void> {
  await db.update(conversations).set({ ...patch, updatedAt: new Date() }).where(eq(conversations.id, cid));
}

export const listInbox = (status?: Conversation['status']) => {
  const q = db.select().from(conversations).$dynamic();
  if (status) q.where(eq(conversations.status, status));
  return q.orderBy(desc(conversations.updatedAt)).all();
};

export const listMessages = (cid: string) =>
  db.select().from(messages).where(eq(messages.conversationId, cid)).orderBy(messages.createdAt).all();

export async function addMessage(input: Omit<NewMessage, 'id'>): Promise<Message> {
  const row = { id: id('msg'), ...input };
  await db.insert(messages).values(row);
  return (await db.select().from(messages).where(eq(messages.id, row.id)).get())!;
}

export async function addAttachment(input: Omit<NewAttachment, 'id'>): Promise<Attachment> {
  const row = { id: id('att'), ...input };
  await db.insert(attachments).values(row);
  return (await db.select().from(attachments).where(eq(attachments.id, row.id)).get())!;
}

// Cross-ticket dedupe: same image bytes seen on another claim is a fraud signal.
export const findAttachmentsBySha = (sha256: string) =>
  db.select().from(attachments).where(eq(attachments.sha256, sha256)).all();
