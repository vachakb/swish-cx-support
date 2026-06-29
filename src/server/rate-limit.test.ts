import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { hitWindow, rateLimit } from './rate-limit';
import type { WindowState } from './rate-limit';

const store = () => new Map<string, WindowState>();

describe('hitWindow (fixed-window rate limit)', () => {
  it('allows up to the limit, then blocks', () => {
    const s = store();
    for (let i = 0; i < 3; i++) expect(hitWindow(s, 'ip', 3, 1000, 0).allowed).toBe(true);
    expect(hitWindow(s, 'ip', 3, 1000, 0).allowed).toBe(false);
  });

  it('reports remaining, clamped at zero', () => {
    const s = store();
    expect(hitWindow(s, 'ip', 2, 1000, 0).remaining).toBe(1);
    expect(hitWindow(s, 'ip', 2, 1000, 0).remaining).toBe(0);
    expect(hitWindow(s, 'ip', 2, 1000, 0).remaining).toBe(0); // already over the limit
  });

  it('resets once the window elapses', () => {
    const s = store();
    expect(hitWindow(s, 'ip', 1, 1000, 0).allowed).toBe(true);
    expect(hitWindow(s, 'ip', 1, 1000, 500).allowed).toBe(false); // same window
    expect(hitWindow(s, 'ip', 1, 1000, 1000).allowed).toBe(true); // window rolled over
  });

  it('tracks keys independently', () => {
    const s = store();
    expect(hitWindow(s, 'a', 1, 1000, 0).allowed).toBe(true);
    expect(hitWindow(s, 'a', 1, 1000, 0).allowed).toBe(false);
    expect(hitWindow(s, 'b', 1, 1000, 0).allowed).toBe(true);
  });

  it('reports seconds until reset', () => {
    expect(hitWindow(store(), 'ip', 5, 60_000, 0).resetSec).toBe(60);
  });
});

describe('rateLimit middleware', () => {
  it('serves under the limit, then 429s with Retry-After + RateLimit headers', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ limit: 2, windowMs: 60_000, enabled: true, key: () => 'fixed' }));
    app.get('/', (c) => c.text('ok'));

    const first = await app.request('/');
    expect(first.status).toBe(200);
    expect(first.headers.get('RateLimit-Remaining')).toBe('1');

    const second = await app.request('/');
    expect(second.status).toBe(200);
    expect(second.headers.get('RateLimit-Remaining')).toBe('0');

    const third = await app.request('/');
    expect(third.status).toBe(429);
    expect(third.headers.get('RateLimit-Limit')).toBe('2');
    expect(third.headers.get('Retry-After')).toBeTruthy();
    expect(((await third.json()) as { error: string }).error).toBe('rate_limited');
  });

  it('is a pass-through when disabled', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ limit: 1, windowMs: 60_000, enabled: false, key: () => 'fixed' }));
    app.get('/', (c) => c.text('ok'));
    expect((await app.request('/')).status).toBe(200);
    expect((await app.request('/')).status).toBe(200); // would 429 if the limiter were active
  });
});
