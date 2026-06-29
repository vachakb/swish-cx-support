import type { Intent } from './types';

// Close + archive a thread after this long without a customer reply.
export const INACTIVITY_CLOSE_MS = 10 * 60 * 1000;

const TITLES: Partial<Record<Intent, string>> = {
  order_status: 'Order tracking',
  order_issue: 'Order issue',
  cancel_order: 'Cancel order',
  referral_status: 'Referral reward',
  faq: 'General question',
  human: 'Talk to a human',
  greeting: 'New chat',
  closing: 'New chat',
};

export function deriveTitle(intent: Intent, text: string): string {
  return TITLES[intent] ?? (text.length > 40 ? `${text.slice(0, 40)}…` : text);
}
