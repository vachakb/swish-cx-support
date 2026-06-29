import type { OrderWithItems } from './types';

// All possible top-level help topics.
const TOPIC = {
  track: { id: 'track', label: "Where's my order?", icon: '📍' },
  cancel: { id: 'cancel', label: 'Cancel my order', icon: '✕' },
  refund_status: { id: 'refund_status', label: 'I want to know my refund status', icon: '↺' },
  not_right: { id: 'not_right', label: "Something's not right with my food", icon: '🍽️' },
  not_received: { id: 'not_received', label: "I didn't receive my order", icon: '📦' },
  misconduct: { id: 'misconduct', label: 'Report a delivery partner issue', icon: '⚠️' },
  other: { id: 'other_topic', label: 'Something else', icon: '💬' },
} as const;

export type Topic = { id: string; label: string; icon?: string };

// The right topics depend on where the order is in its lifecycle — you can't ask for a refund
// on an order that's still on its way, and you can't track one that's already delivered.
export function topicsForStatus(status: string): Topic[] {
  if (status === 'delivered') return [TOPIC.refund_status, TOPIC.not_right, TOPIC.not_received, TOPIC.misconduct];
  if (status === 'cancelled') return [TOPIC.refund_status, TOPIC.other];
  if (status === 'placed' || status === 'preparing') return [TOPIC.track, TOPIC.cancel, TOPIC.other]; // not out yet → no rider issue
  return [TOPIC.track, TOPIC.cancel, TOPIC.misconduct, TOPIC.other]; // packed / dispatched / arriving
}

// Shown after "Something's not right".
export const SUB_ISSUES = [
  { id: 'missing', label: 'A few items are missing' },
  { id: 'wrong', label: 'A few items are wrong' },
  { id: 'spilled', label: "It's spilled" },
  { id: 'quality', label: "Food didn't taste right" },
  { id: 'other', label: 'Got a different issue' },
] as const;

// Topics that go straight to the agent with a clear opening message.
export const TOPIC_SENDS: Record<string, string> = {
  track: 'Where is my order?',
  cancel: "I'd like to cancel my order.",
  refund_status: "I'd like to know my refund status for this order.",
  not_received: "I didn't receive my order.",
  misconduct: 'I want to report misconduct by the delivery partner.',
};

// Turn (issue type + chosen items) into a precise first message for the resolution agent.
export function composeIssueMessage(issue: string, items: string[]): string {
  const list = items.join(', ');
  switch (issue) {
    case 'missing':
      return `A few items are missing from my order: ${list}.`;
    case 'wrong':
      return `I received the wrong items: ${list}.`;
    case 'spilled':
      return `These items arrived spilled or leaking: ${list}.`;
    case 'quality':
      return `These items didn't taste right: ${list}.`;
    default:
      return `I have an issue with: ${list}.`;
  }
}

export function orderItemNames(o: OrderWithItems): string {
  return o.items.map((i) => i.name).join(', ');
}
