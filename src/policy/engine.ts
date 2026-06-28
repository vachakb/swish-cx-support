import { Engine } from 'json-rules-engine';
import type { ActionRequest } from '../providers/types';
import type { PolicyTrace } from '../types';
import { claimRules } from './rules';
import type { RiskSignals } from './signals';

export type PolicyOutcome = 'auto_approve' | 'escalate' | 'deny';

export interface ClaimContext {
  action: ActionRequest;
  signals: RiskSignals;
  corroborated: boolean;
  imageDuplicate: boolean;
}

export interface PolicyDecision {
  outcome: PolicyOutcome;
  reasons: string[];
  trace: PolicyTrace;
}

const SEVERITY: Record<PolicyOutcome, number> = { auto_approve: 0, escalate: 1, deny: 2 };

// Engine is stateless across runs; build once and reuse.
const engine = new Engine(claimRules, { allowUndefinedFacts: true });

export async function decideClaim(ctx: ClaimContext): Promise<PolicyDecision> {
  const facts = {
    amount: 'amount' in ctx.action ? ctx.action.amount : 0,
    recentClaims: ctx.signals.recentClaims,
    accountAgeDays: ctx.signals.accountAgeDays,
    lifetimeRefundRatio: ctx.signals.lifetimeRefundRatio,
    corroborated: ctx.corroborated,
    imageDuplicate: ctx.imageDuplicate,
  };

  const { events } = await engine.run(facts);

  let outcome: PolicyOutcome = 'auto_approve';
  const reasons: string[] = [];
  const rules: PolicyTrace['rules'] = [];
  for (const e of events) {
    const candidate = e.type as PolicyOutcome;
    const reason = String(e.params?.reason ?? candidate);
    reasons.push(reason);
    rules.push({ id: reason, passed: true });
    if (SEVERITY[candidate] > SEVERITY[outcome]) outcome = candidate;
  }
  if (outcome === 'auto_approve') reasons.push('all checks passed');
  return { outcome, reasons, trace: { rules, decision: outcome } };
}
