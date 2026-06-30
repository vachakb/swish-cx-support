import { describe, expect, it } from 'vitest';
import { envOr } from './config';

// Guards the .env.example blank-override trap: an empty/whitespace value must fall back, not pass through.
describe('envOr', () => {
  it('uses the value when set', () => expect(envOr('gemini-3.5-flash', 'fallback')).toBe('gemini-3.5-flash'));
  it('falls back on undefined', () => expect(envOr(undefined, 'fallback')).toBe('fallback'));
  it('falls back on empty string (blank override line)', () => expect(envOr('', 'fallback')).toBe('fallback'));
  it('falls back on whitespace-only', () => expect(envOr('   ', 'fallback')).toBe('fallback'));
  it('trims surrounding whitespace', () => expect(envOr('  gemini-3.1-flash-lite  ', 'fallback')).toBe('gemini-3.1-flash-lite'));
});
