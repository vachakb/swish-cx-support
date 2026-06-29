import { describe, expect, it } from 'vitest';
import { redactPii, redactValue } from './redact';

describe('redactPii', () => {
  it('masks phone numbers', () => {
    expect(redactPii('call me on 9876543210')).toBe('call me on [phone]');
    expect(redactPii('reach me at +91 9876543210 please')).toBe('reach me at [phone] please');
  });

  it('masks emails and UPI handles', () => {
    expect(redactPii('email arjun@gmail.com')).toBe('email [email]');
    expect(redactPii('pay me at arjun@okhdfcbank')).toBe('pay me at [upi]');
  });

  it('masks card / long id numbers', () => {
    expect(redactPii('card 4111 1111 1111 1111')).toBe('card [card]');
  });

  it('leaves order data and small numbers alone', () => {
    expect(redactPii('order ord_stuck, 2 chais for ₹260')).toBe('order ord_stuck, 2 chais for ₹260');
  });

  it('redacts strings inside structured trace data, leaving non-strings', () => {
    expect(redactValue({ note: 'customer 9876543210 angry', amount: 16000, reasons: ['call 9876543210'] })).toEqual({
      note: 'customer [phone] angry',
      amount: 16000,
      reasons: ['call [phone]'],
    });
  });
});
