import { EventEmitter } from 'node:events';
import type { Message } from '../repositories';

// In-process pub/sub for live message push (SSE).
const emitter = new EventEmitter();
emitter.setMaxListeners(0); // many concurrent SSE subscribers

const channel = (conversationId: string) => `msg:${conversationId}`;

export function publishMessage(conversationId: string, message: Message): void {
  emitter.emit(channel(conversationId), message);
}

export function subscribeMessages(conversationId: string, cb: (m: Message) => void): () => void {
  const ev = channel(conversationId);
  emitter.on(ev, cb);
  return () => emitter.off(ev, cb);
}

// Customer-level channel: notifications that aren't tied to the chat the customer happens to have open
// (e.g. a proactive "your order's running late" nudge about any of their orders).
export interface CustomerEvent {
  conversationId: string;
  kind: string;
  text: string;
}
const custChannel = (customerId: string) => `cust:${customerId}`;

export function publishCustomerEvent(customerId: string, event: CustomerEvent): void {
  emitter.emit(custChannel(customerId), event);
}

export function subscribeCustomer(customerId: string, cb: (e: CustomerEvent) => void): () => void {
  const ev = custChannel(customerId);
  emitter.on(ev, cb);
  return () => emitter.off(ev, cb);
}
