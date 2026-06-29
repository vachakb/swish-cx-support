import { etaConfig } from './config';

export type EtaConfidence = 'high' | 'medium' | 'low';
export type EtaRecommendation = 'show_eta' | 'acknowledge_delay' | 'investigate';

export interface EtaTruth {
  confidence: EtaConfidence;
  displayEtaSeconds: number | null; // a FRESH estimate; null = don't quote a number, it isn't trustworthy
  freshEtaSeconds: number | null;
  riderDistanceM: number | null;
  isStale: boolean;
  isStuck: boolean;
  isBreached: boolean;
  minutesLate: number;
  recommendation: EtaRecommendation;
  reasons: string[];
}

export interface EtaInput {
  etaSeconds: number;
  etaLastComputedAt: Date;
  riderLastGpsAt: Date | null;
  distanceRemainingM: number | null;
  promisedBy: Date;
  now: number;
}

const mins = (ms: number) => Math.round(ms / 60_000);
const HANDOFF_S = 60; // last-leg buffer (park, walk up) on top of travel time

// The heart of the "stuck ETA" fix: reason over the ETA's freshness, and recompute a FRESH estimate
// from the rider's distance rather than ever parroting a cached/frozen number.
export function assessEta(input: EtaInput): EtaTruth {
  const etaAgeMs = input.now - input.etaLastComputedAt.getTime();
  const gpsAgeMs = input.riderLastGpsAt ? input.now - input.riderLastGpsAt.getTime() : null;
  const pastPromiseMs = input.now - input.promisedBy.getTime();

  const etaStale = etaAgeMs > etaConfig.etaStaleMs;
  const gpsStale = gpsAgeMs !== null && gpsAgeMs > etaConfig.gpsStaleMs;
  const noGps = gpsAgeMs === null;
  const isStale = etaStale || gpsStale;
  // "Stuck" = the ETA hasn't been recomputed AND there's no fresh GPS to recompute it from.
  const isStuck = etaStale && (gpsStale || noGps);
  const isBreached = pastPromiseMs > 0;
  const severe = pastPromiseMs > etaConfig.severeBreachMs;
  const minutesLate = Math.max(0, mins(pastPromiseMs));

  // Always quote a FRESH number: trust the cached ETA only while it's fresh; otherwise recompute
  // from current rider distance; if the rider data can't be trusted at all, quote nothing.
  let freshEtaSeconds: number | null;
  if (!etaStale) freshEtaSeconds = input.etaSeconds;
  else if (!isStuck && input.distanceRemainingM != null) freshEtaSeconds = Math.round(input.distanceRemainingM / etaConfig.deliverySpeedMps) + HANDOFF_S;
  else freshEtaSeconds = null;

  const reasons: string[] = [];
  if (gpsStale) reasons.push(`rider GPS last updated ~${mins(gpsAgeMs!)} min ago`);
  if (noGps) reasons.push('no rider GPS available');
  if (etaStale) reasons.push(`cached ETA not recomputed in ~${mins(etaAgeMs)} min`);
  if (isBreached) reasons.push(`${minutesLate} min past the promised time`);
  if (!reasons.length) reasons.push('fresh GPS and ETA, within promise');

  let confidence: EtaConfidence = 'high';
  if (isStuck || severe) confidence = 'low';
  else if (isStale || isBreached) confidence = 'medium';

  let recommendation: EtaRecommendation = 'show_eta';
  if (isStuck) recommendation = 'investigate';
  else if (isBreached || isStale) recommendation = 'acknowledge_delay';

  return {
    confidence,
    displayEtaSeconds: freshEtaSeconds,
    freshEtaSeconds,
    riderDistanceM: input.distanceRemainingM,
    isStale,
    isStuck,
    isBreached,
    minutesLate,
    recommendation,
    reasons,
  };
}
