// Refund/fraud thresholds (would be ops-editable rule-engine JSON in production).
export const policyConfig = {
  autoApproveCapPaise: 50_000, // ₹500 — claims at/under this can auto-resolve
  velocityWindowDays: 7,
  velocityLimit: 6, // >= this many claims in the window → escalate (genuine abuse, not an unlucky week)
  minAccountAgeDays: 7,
  newAccountCapPaise: 20_000, // ₹200 cap for accounts younger than minAccountAgeDays
  lifetimeRefundRatioLimit: 1.0, // claims/orders — only flags accounts refunding ~every order
  refundProcessingDays: 7, // ToS: refunds land within this many business days of confirmation
} as const;

export const REFUND_PROCESSING_MS = policyConfig.refundProcessingDays * 24 * 60 * 60 * 1000;
