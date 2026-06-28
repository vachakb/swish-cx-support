// Tunable refund/fraud thresholds. In production these would be authored as
// @swishhq/rule-engine JSON so ops can change them without a deploy.
export const policyConfig = {
  autoApproveCapPaise: 50_000, // ₹500 — claims at/under this can auto-resolve
  velocityWindowDays: 7,
  velocityLimit: 3, // >= this many claims in the window → escalate
  minAccountAgeDays: 7,
  newAccountCapPaise: 20_000, // ₹200 cap for accounts younger than minAccountAgeDays
  lifetimeRefundRatioLimit: 0.5, // claims / orders
} as const;
