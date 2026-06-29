import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { config } from '../config';

export interface WindowState {
  count: number;
  resetAt: number; // epoch ms at which this fixed window rolls over
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  resetSec: number;
}

// Pure fixed-window counter — the caller owns the store + clock, so it's trivially unit-testable.
export function hitWindow(store: Map<string, WindowState>, key: string, limit: number, windowMs: number, now: number): RateDecision {
  let w = store.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs };
    store.set(key, w);
  }
  w.count += 1;
  return { allowed: w.count <= limit, remaining: Math.max(0, limit - w.count), resetSec: Math.max(0, Math.ceil((w.resetAt - now) / 1000)) };
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  key?: (c: Context) => string;
  enabled?: boolean; // defaults to config; override in tests
}

// In-process rate-limit middleware. Correct for a single instance; the store swaps for Redis at N instances.
export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const enabled = opts.enabled ?? config.rateLimit.enabled;
  if (!enabled) return async (_c, next) => next();

  const store = new Map<string, WindowState>();
  // Evict expired windows so a flood of distinct IPs can't grow the map without bound.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, w] of store) if (w.resetAt <= now) store.delete(k);
  }, opts.windowMs);
  sweep.unref();

  const keyOf = opts.key ?? clientIp;

  return async (c, next) => {
    const d = hitWindow(store, keyOf(c), opts.limit, opts.windowMs, Date.now());
    c.header('RateLimit-Limit', String(opts.limit));
    c.header('RateLimit-Remaining', String(d.remaining));
    c.header('RateLimit-Reset', String(d.resetSec));
    if (!d.allowed) {
      c.header('Retry-After', String(d.resetSec));
      return c.json({ error: 'rate_limited', message: "You're sending requests a little too fast — give it a moment and try again." }, 429);
    }
    return next();
  };
}

// Best-effort client key: the Node socket address, then a proxy header, then a shared fallback bucket.
function clientIp(c: Context): string {
  try {
    const addr = getConnInfo(c).remote.address;
    if (addr) return addr;
  } catch {
    // not running under @hono/node-server (e.g. a unit test) — fall through to the header
  }
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
