import type { Intent } from './types';

// Close + archive a thread after this long without a customer reply.
export const INACTIVITY_CLOSE_MS = 10 * 60 * 1000;

const TITLES: Partial<Record<Intent, string>> = {
  order_status: "Where's my order?",
  order_issue: "Something's not right with my order",
  cancel_order: 'Cancel my order',
  referral_status: 'My referral reward',
  faq: 'A quick question',
  human: 'Talk to a teammate',
  greeting: 'Support chat',
  closing: 'Support chat',
};

export function deriveTitle(intent: Intent, text: string): string {
  return TITLES[intent] ?? (text.length > 40 ? `${text.slice(0, 40)}…` : text);
}
