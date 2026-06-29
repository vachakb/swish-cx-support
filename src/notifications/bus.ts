import { EventEmitter } from 'node:events';
import type { Message } from '../repositories';

// In-process pub/sub for live message push (SSE). Swap for Redis pub/sub when you run >1 instance —
// the interface stays the same.
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
