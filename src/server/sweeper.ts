import { publishMessage } from '../notifications/bus';
import { INACTIVITY_CLOSE_MS, INACTIVITY_FAREWELL } from '../pipeline/lifecycle';
import * as repo from '../repositories';

const SWEEP_INTERVAL_MS = 60 * 1000;

// Close quiet chats, leave a warm sign-off, and push it over SSE.
export async function sweepStaleConversations(thresholdMs = INACTIVITY_CLOSE_MS): Promise<number> {
  const closed = await repo.closeStaleConversations(thresholdMs);
  for (const conv of closed) {
    const msg = await repo.addMessage({ conversationId: conv.id, role: 'assistant', text: INACTIVITY_FAREWELL, payload: { kind: 'inactivity_close' } });
    publishMessage(conv.id, msg);
  }
  return closed.length;
}

export function startInactivitySweeper(intervalMs = SWEEP_INTERVAL_MS): () => void {
  const timer = setInterval(() => {
    void sweepStaleConversations().catch(() => {}); // never crash the loop
  }, intervalMs);
  timer.unref?.(); // don't keep the process alive
  return () => clearInterval(timer);
}
