import { describe, expect, it } from 'vitest';
import { validateStartAt, validateTitle } from './validation';

describe('validateTitle', () => {
  it('rejects a title shorter than 3 characters after trimming', () => {
    expect(validateTitle('  ab  ')).toEqual({
      valid: false,
      message: expect.any(String),
    });
  });

  it('rejects a title longer than 80 characters', () => {
    expect(validateTitle('a'.repeat(81)).valid).toBe(false);
  });

  it('accepts a title at the 3 character boundary after trimming', () => {
    expect(validateTitle('  abc  ')).toEqual({ valid: true });
  });

  it('accepts a title at the 80 character boundary', () => {
    expect(validateTitle('a'.repeat(80))).toEqual({ valid: true });
  });

  it('rejects a whitespace-only title', () => {
    expect(validateTitle('    ').valid).toBe(false);
  });
});

describe('validateStartAt', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('rejects an empty value', () => {
    expect(validateStartAt('', now).valid).toBe(false);
  });

  it('rejects an unparseable value', () => {
    expect(validateStartAt('not-a-date', now).valid).toBe(false);
  });

  it('rejects a date in the past', () => {
    expect(validateStartAt('2025-01-01T00:00:00.000Z', now).valid).toBe(false);
  });

  it('rejects the current instant', () => {
    expect(validateStartAt(now.toISOString(), now).valid).toBe(false);
  });

  it('accepts a date in the future', () => {
    expect(validateStartAt('2026-06-01T00:00:00.000Z', now)).toEqual({ valid: true });
  });
});
