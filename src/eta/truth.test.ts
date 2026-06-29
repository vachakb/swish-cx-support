import { describe, expect, it } from 'vitest';
import { assessEta } from './truth';

const NOW = 1_700_000_000_000;
const ago = (ms: number) => new Date(NOW - ms);
const ahead = (ms: number) => new Date(NOW + ms);
const base = { distanceRemainingM: 800 };

describe('assessEta', () => {
  it('trusts a fresh ETA before the promise', () => {
    const t = assessEta({ ...base, etaSeconds: 300, etaLastComputedAt: ago(15_000), riderLastGpsAt: ago(8_000), promisedBy: ahead(360_000), now: NOW });
    expect(t.confidence).toBe('high');
    expect(t.recommendation).toBe('show_eta');
    expect(t.displayEtaSeconds).toBe(300);
  });

  it('refuses to quote a stuck ETA (frozen number, dead GPS, past promise) and investigates', () => {
    const t = assessEta({ ...base, distanceRemainingM: 1200, etaSeconds: 180, etaLastComputedAt: ago(20 * 60_000), riderLastGpsAt: ago(20 * 60_000), promisedBy: ago(12 * 60_000), now: NOW });
    expect(t.confidence).toBe('low');
    expect(t.isStuck).toBe(true);
    expect(t.recommendation).toBe('investigate');
    expect(t.displayEtaSeconds).toBeNull();
  });

  it('recomputes a FRESH ETA from rider distance when the cached one is stale but GPS is live', () => {
    const t = assessEta({ etaSeconds: 180, etaLastComputedAt: ago(5 * 60_000), riderLastGpsAt: ago(10_000), distanceRemainingM: 1040, promisedBy: ahead(120_000), now: NOW });
    expect(t.isStuck).toBe(false);
    expect(t.recommendation).toBe('acknowledge_delay');
    expect(t.displayEtaSeconds).toBe(260); // 1040 / 5.2 + 60s handoff — fresh, not the cached 180
  });

  it('acknowledges a genuine delay when the rider is still tracking fresh', () => {
    const t = assessEta({ ...base, etaSeconds: 120, etaLastComputedAt: ago(10_000), riderLastGpsAt: ago(5_000), promisedBy: ago(120_000), now: NOW });
    expect(t.isBreached).toBe(true);
    expect(t.isStuck).toBe(false);
    expect(t.recommendation).toBe('acknowledge_delay');
  });

  it("investigates when both ETA and GPS are stale (can't be trusted), even before the promise", () => {
    const t = assessEta({ ...base, etaSeconds: 240, etaLastComputedAt: ago(5 * 60_000), riderLastGpsAt: ago(5 * 60_000), promisedBy: ahead(180_000), now: NOW });
    expect(t.isStuck).toBe(true);
    expect(t.recommendation).toBe('investigate');
    expect(t.displayEtaSeconds).toBeNull();
  });
});
