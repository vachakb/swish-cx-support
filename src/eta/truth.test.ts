import { describe, expect, it } from 'vitest';
import { assessEta } from './truth';

const NOW = 1_700_000_000_000;
const ago = (ms: number) => new Date(NOW - ms);
const ahead = (ms: number) => new Date(NOW + ms);

describe('assessEta', () => {
  it('trusts a fresh ETA before the promise', () => {
    const t = assessEta({ etaSeconds: 300, etaLastComputedAt: ago(15_000), riderLastGpsAt: ago(8_000), promisedBy: ahead(360_000), now: NOW });
    expect(t.confidence).toBe('high');
    expect(t.recommendation).toBe('show_eta');
    expect(t.displayEtaSeconds).toBe(300);
  });

  it('catches the stuck ETA (frozen number, dead GPS, past promise) and refuses to quote it', () => {
    const t = assessEta({ etaSeconds: 180, etaLastComputedAt: ago(20 * 60_000), riderLastGpsAt: ago(20 * 60_000), promisedBy: ago(12 * 60_000), now: NOW });
    expect(t.confidence).toBe('low');
    expect(t.isStuck).toBe(true);
    expect(t.isBreached).toBe(true);
    expect(t.recommendation).toBe('proactive_remedy');
    expect(t.displayEtaSeconds).toBeNull();
  });

  it('acknowledges a genuine delay when the rider is still tracking fresh', () => {
    const t = assessEta({ etaSeconds: 120, etaLastComputedAt: ago(10_000), riderLastGpsAt: ago(5_000), promisedBy: ago(120_000), now: NOW });
    expect(t.isBreached).toBe(true);
    expect(t.isStuck).toBe(false);
    expect(t.recommendation).toBe('acknowledge_delay');
  });

  it('is cautious when tracking is stale but the promise has not passed', () => {
    const t = assessEta({ etaSeconds: 240, etaLastComputedAt: ago(5 * 60_000), riderLastGpsAt: ago(5 * 60_000), promisedBy: ahead(180_000), now: NOW });
    expect(t.isStale).toBe(true);
    expect(t.isBreached).toBe(false);
    expect(t.recommendation).toBe('acknowledge_delay');
    expect(t.displayEtaSeconds).toBeNull();
  });
});
