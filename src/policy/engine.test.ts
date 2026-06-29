import { describe, expect, it } from 'vitest';
import type { ActionRequest } from '../providers/types';
import { decideClaim } from './engine';
import type { RiskSignals } from './signals';

const refund = (amount: number): ActionRequest =>
  ({ type: 'refund', orderId: 'o1', amount, conversationId: 'cv', customerId: 'c', reason: 'spillage', idempotencyKey: 'k' });

const trusted: RiskSignals = { accountAgeDays: 420, recentClaims: 0, lifetimeClaimCount: 1, lifetimeOrderCount: 20, lifetimeRefundRatio: 0.05 };

describe('decideClaim', () => {
  it('auto-approves a small, corroborated claim from a trusted account', async () => {
    const d = await decideClaim({ action: refund(12000), signals: trusted, corroborated: true, imageDuplicate: false });
    expect(d.outcome).toBe('auto_approve');
  });

  it('escalates when the amount exceeds the auto-approve cap', async () => {
    const d = await decideClaim({ action: refund(60000), signals: trusted, corroborated: true, imageDuplicate: false });
    expect(d.outcome).toBe('escalate');
  });

  it('escalates on high claim velocity (the repeat-claimant signal)', async () => {
    const d = await decideClaim({ action: refund(12000), signals: { ...trusted, recentClaims: 6 }, corroborated: true, imageDuplicate: false });
    expect(d.outcome).toBe('escalate');
  });

  it('escalates an uncorroborated claim', async () => {
    const d = await decideClaim({ action: refund(12000), signals: trusted, corroborated: false, imageDuplicate: false });
    expect(d.outcome).toBe('escalate');
  });

  it('denies a claim backed by a reused image', async () => {
    const d = await decideClaim({ action: refund(12000), signals: trusted, corroborated: true, imageDuplicate: true });
    expect(d.outcome).toBe('deny');
  });
});
