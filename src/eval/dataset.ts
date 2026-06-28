import type { Intent } from '../pipeline/types';

export interface RouteCase {
  text: string;
  expected: Intent;
}

// Labeled routing cases. The first block is covered by deterministic rules; the second block
// ("tail") has no keyword trigger, so rules-only must fall back to 'unknown'.
export const routeCases: RouteCase[] = [
  { text: 'where is my order?', expected: 'order_status' },
  { text: "my order is taking forever and it's still not here", expected: 'order_status' },
  { text: 'cancel my order please', expected: 'cancel_order' },
  { text: 'the biryani was completely spilled in the bag', expected: 'order_issue' },
  { text: 'I only received 1 of the 2 rolls I ordered', expected: 'order_issue' },
  { text: 'this is the wrong order, not what I ordered', expected: 'order_issue' },
  { text: 'where is my referral reward?', expected: 'referral_status' },
  { text: 'I referred a friend last week, do I get credit?', expected: 'referral_status' },
  { text: 'do you deliver to Indiranagar?', expected: 'faq' },
  { text: 'can I speak to a human please', expected: 'human' },
  // Tail — no rule keyword:
  { text: 'hey there!', expected: 'greeting' },
  { text: 'hi, good morning', expected: 'greeting' },
  { text: 'thanks so much for the help', expected: 'greeting' },
  { text: 'what are your delivery hours?', expected: 'faq' },
  { text: 'how does swish actually work?', expected: 'faq' },
];
