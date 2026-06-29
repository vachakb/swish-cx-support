import type { OrderWithItems } from './types';

// Top-level options shown when help is opened for a specific order (mirrors Swish).
export const ORDER_TOPICS = [
  { id: 'refund_status', label: 'I want to know my refund status', icon: '↺' },
  { id: 'not_right', label: "Something's not right with my food", icon: '🍽️' },
  { id: 'not_received', label: "I didn't receive my order", icon: '📦' },
  { id: 'misconduct', label: 'Report a delivery partner issue', icon: '⚠️' },
] as const;

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
