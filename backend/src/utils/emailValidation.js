import { LIMITS } from '../schemas/commonSchemas.js';

// Canonical email format check, shared across controllers so the same regex
// isn't duplicated (and can't drift). Standardises on the stricter TLD (>=2
// chars) variant.
//
// SECURITY (KAN-161): the pattern has polynomial backtracking, so we length-cap
// the (trimmed) input via LIMITS.email BEFORE running the regex. The cap runs
// first and short-circuits, bounding worst-case work to constant time — without
// it, a crafted long string on the public RSVP route is a reachable ReDoS. Do
// not reorder the length check after the regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > LIMITS.email) return false;
  return EMAIL_RE.test(trimmed);
}
