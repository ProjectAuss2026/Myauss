import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dns/promises before importing the module
const mockResolveMx = vi.fn();
vi.mock('node:dns/promises', () => ({
  default: { resolveMx: (...args) => mockResolveMx(...args) },
  resolveMx: (...args) => mockResolveMx(...args),
}));

const { validateEmailDeliverability, parseAllowlist } = await import('../utils/emailDeliverability.js');

describe('validateEmailDeliverability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deliverable:true for an allowlisted domain (skip MX)', async () => {
    const result = await validateEmailDeliverability('user@auckland.ac.nz', {
      allowlist: new Set(['auckland.ac.nz']),
    });
    expect(result.deliverable).toBe(true);
    expect(mockResolveMx).not.toHaveBeenCalled();
  });

  it('returns deliverable:true when MX records exist', async () => {
    mockResolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);
    const result = await validateEmailDeliverability('user@example.com');
    expect(result.deliverable).toBe(true);
  });

  it('returns deliverable:false when MX resolves to empty array', async () => {
    mockResolveMx.mockResolvedValue([]);
    const result = await validateEmailDeliverability('user@no-mx-records.com');
    expect(result.deliverable).toBe(false);
    expect(result.reason).toBe('no_mx_records');
  });

  it('fails open (deliverable:true) on DNS timeout within 3.5s', async () => {
    // Never resolves — simulate a hung DNS resolver
    mockResolveMx.mockImplementation(() => new Promise(() => {}));
    const start = Date.now();
    const result = await validateEmailDeliverability('user@timeout.com');
    const elapsed = Date.now() - start;
    expect(result.deliverable).toBe(true);
    expect(elapsed).toBeLessThan(3500); // 3 s timeout + 500 ms tolerance
  }, 5000);

  it('fails open on other DNS errors', async () => {
    mockResolveMx.mockRejectedValue(Object.assign(new Error('SERVFAIL'), { code: 'SERVFAIL' }));
    const result = await validateEmailDeliverability('user@dns-error.com');
    expect(result.deliverable).toBe(true);
  });

  it('returns deliverable:false for invalid email format (no domain)', async () => {
    const result = await validateEmailDeliverability('notanemail');
    expect(result.deliverable).toBe(false);
    expect(result.reason).toBe('invalid_email_format');
  });

  it('returns deliverable:false for email with no @', async () => {
    const result = await validateEmailDeliverability('noatsign.com');
    expect(result.deliverable).toBe(false);
    expect(result.reason).toBe('invalid_email_format');
  });
});

describe('parseAllowlist', () => {
  it('parses comma-separated domains into a Set', () => {
    const result = parseAllowlist('auckland.ac.nz, aucklanduni.ac.nz , EXAMPLE.COM');
    expect(result).toEqual(new Set(['auckland.ac.nz', 'aucklanduni.ac.nz', 'example.com']));
  });

  it('returns empty Set for empty string', () => {
    expect(parseAllowlist('')).toEqual(new Set());
  });

  it('returns empty Set for null/undefined', () => {
    expect(parseAllowlist(null)).toEqual(new Set());
    expect(parseAllowlist(undefined)).toEqual(new Set());
  });
});
