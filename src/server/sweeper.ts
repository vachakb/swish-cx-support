import { publishMessage } from '../notifications/bus';
import { INACTIVITY_CLOSE_MS, INACTIVITY_FAREWELL } from '../pipeline/lifecycle';
import * as repo from '../repositories';

// How often the service checks for chats that have gone quiet. The inactivity threshold itself is
// INACTIVITY_CLOSE_MS; this only bounds how soon after crossing it we act.
const SWEEP_INTERVAL_MS = 60 * 1000;

// Close any chat that's gone quiet, leave the customer a warm sign-off, and push it over SSE so an
// open chat hears about it immediately (and gets a notification if they've left the screen).
export async function sweepStaleConversations(thresholdMs = INACTIVITY_CLOSE_MS): Promise<number> {
  const closed = await repo.closeStaleConversations(thresholdMs);
  for (const conv of closed) {
    const msg = await repo.addMessage({ conversationId: conv.id, role: 'assistant', text: INACTIVITY_FAREWELL, payload: { kind: 'inactivity_close' } });
    publishMessage(conv.id, msg);
  }
  return closed.length;
}

// Runs for the life of the service, independent of any client request — the chat lifecycle is the
// service's responsibility, not a side effect of someone loading a page.
export function startInactivitySweeper(intervalMs = SWEEP_INTERVAL_MS): () => void {
  const timer = setInterval(() => {
    void sweepStaleConversations().catch(() => {}); // a sweep error must never crash the loop
  }, intervalMs);
  timer.unref?.(); // a background timer shouldn't keep the process alive on its own
  return () => clearInterval(timer);
}
