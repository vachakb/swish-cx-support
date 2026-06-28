import type { RuleProperties } from 'json-rules-engine';
import { policyConfig } from './config';

// Each rule encodes a condition under which we must NOT silently auto-approve.
// If no rule fires, the claim auto-approves. Event type = the outcome it forces.
export const claimRules: RuleProperties[] = [
  {
    conditions: { all: [{ fact: 'amount', operator: 'greaterThan', value: policyConfig.autoApproveCapPaise }] },
    event: { type: 'escalate', params: { reason: 'amount above auto-approve cap' } },
  },
  {
    conditions: { all: [{ fact: 'recentClaims', operator: 'greaterThanInclusive', value: policyConfig.velocityLimit }] },
    event: { type: 'escalate', params: { reason: 'too many recent claims (velocity)' } },
  },
  {
    conditions: {
      all: [
        { fact: 'accountAgeDays', operator: 'lessThan', value: policyConfig.minAccountAgeDays },
        { fact: 'amount', operator: 'greaterThan', value: policyConfig.newAccountCapPaise },
      ],
    },
    event: { type: 'escalate', params: { reason: 'new account with a high-value claim' } },
  },
  {
    conditions: { all: [{ fact: 'lifetimeRefundRatio', operator: 'greaterThan', value: policyConfig.lifetimeRefundRatioLimit }] },
    event: { type: 'escalate', params: { reason: 'high lifetime refund ratio' } },
  },
  {
    conditions: { all: [{ fact: 'corroborated', operator: 'equal', value: false }] },
    event: { type: 'escalate', params: { reason: 'claim not corroborated by order data' } },
  },
  {
    conditions: { all: [{ fact: 'imageDuplicate', operator: 'equal', value: true }] },
    event: { type: 'deny', params: { reason: 'duplicate image reused across tickets' } },
  },
];
