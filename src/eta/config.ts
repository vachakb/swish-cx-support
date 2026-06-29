// Thresholds for judging whether a live ETA can be trusted. Tunable.
export const etaConfig = {
  gpsStaleMs: 90_000, // rider GPS older than this → the ETA is coasting on dead data
  etaStaleMs: 120_000, // ETA not recomputed in this long → cached/stale
  severeBreachMs: 300_000, // this far past the promise → severe
  deliverySpeedMps: 5.2, // ~19 km/h city bike — used to recompute a FRESH ETA from rider distance
} as const;
