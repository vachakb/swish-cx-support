// Mask the PII a support agent never needs to reason over (it's looked up server-side via the
// account) before any text leaves our trust boundary — the third-party model, or logs/traces.
// Order matters: email (has a TLD) is matched before bare UPI handles; phone before long card runs.
const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/\b[\w.-]+@[a-z]{2,}\b/gi, '[upi]'],
  [/(?:\+?91[-\s]?)?\b[6-9]\d{9}\b/g, '[phone]'],
  [/\b\d[\d -]{10,17}\d\b/g, '[card]'],
];

export function redactPii(text: string): string {
  return PATTERNS.reduce((acc, [re, label]) => acc.replace(re, label), text);
}

// Recursively redact string values inside a structured payload (e.g. a trace step's data).
export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactPii(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactValue(v)]));
  return value;
}

// Same, but typed for a record (e.g. a trace step's data) so callers don't need a cast.
export function redactRecord(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k] = redactValue(v);
  return out;
}
