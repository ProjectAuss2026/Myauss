import dns from 'node:dns/promises';

const MX_TIMEOUT_MS = 3000;

/**
 * Resolves MX records for the given domain with a timeout.
 * Returns the MX records array, or null if DNS is unreachable.
 */
async function resolveMxWithTimeout(domain) {
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('mx_timeout'), { code: 'ETIMEOUT' })), MX_TIMEOUT_MS),
      ),
    ]);
    return records;
  } catch (err) {
    // No MX records — domain can't receive mail
    if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') {
      return [];
    }
    // Timeout or other DNS/network errors — fail open, allow registration
    return null;
  }
}

/**
 * Extracts the domain from an email address.
 * Returns null if the email format is invalid.
 */
function getDomain(email) {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1 || atIndex === email.length - 1) return null;
  return email.slice(atIndex + 1).toLowerCase();
}

/**
 * Validates that an email address's domain can receive mail.
 *
 * Strategy:
 * 1. Check against a configurable domain allowlist (skip MX check for known domains).
 * 2. If not allowlisted, perform a DNS MX lookup with a 3-second timeout.
 * 3. Fail open: if DNS is unreachable (timeout/NETWORK error), skip the check.
 * 4. Fail closed: if MX records are empty (ENOTFOUND/ENODATA), the domain has no
 *    mail server — return false.
 *
 * @param {string} email
 * @param {{ allowlist?: Set<string> }} options
 * @returns {Promise<{ deliverable: boolean, reason?: string }>}
 */
export async function validateEmailDeliverability(email, options = {}) {
  const domain = getDomain(email);
  if (!domain) {
    return { deliverable: false, reason: 'invalid_email_format' };
  }

  // Allowlist check — skip DNS for known-good domains
  if (options.allowlist?.has(domain)) {
    return { deliverable: true };
  }

  const mxRecords = await resolveMxWithTimeout(domain);

  if (mxRecords === null) {
    // DNS unreachable — fail open
    return { deliverable: true };
  }

  if (mxRecords.length === 0) {
    return { deliverable: false, reason: 'no_mx_records' };
  }

  return { deliverable: true };
}

/**
 * Parses a comma-separated EMAIL_MX_ALLOWLIST env var into a Set.
 */
export function parseAllowlist(raw) {
  if (!raw || typeof raw !== 'string') return new Set();
  return new Set(
    raw
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  );
}
