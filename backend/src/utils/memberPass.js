import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Member event pass (KAN-180).
 *
 * The pass is derived from the account's existing UUID rather than a separate
 * stored secret:
 *
 *   {userId}:{qrVersion}:{HMAC-SHA256(userId + ":" + qrVersion, QR_PASS_SECRET)}
 *
 * Why the id is in the payload as well as inside the HMAC: an HMAC cannot be
 * reversed, so without the id the scanner would have no candidate to verify
 * against and would have to recompute the digest for every member on every scan.
 * Including it keeps verification to the single indexed lookup we already do to
 * find the RSVP. The id is not sensitive — it is already returned by /me and the
 * admin roster — and knowing it does not let anyone forge the signature.
 *
 * Why not the raw UUID as the pass: it is already exposed to every exec who has
 * opened the Members tab, and it cannot be rotated (19 tables foreign-key to it).
 * `qrVersion` provides per-member revocation instead — bump it and that member's
 * pass dies immediately, with no effect on anyone else.
 *
 * The value is deliberately stable until reset: a member at a venue with no
 * signal must be able to present a screenshot. Sharing is accepted rather than
 * solved — an exec sees the person, and one-check-in-per-member-per-event makes
 * a shared pass self-detecting when the real member scans later.
 */

export class MemberPassError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MemberPassError';
  }
}

export function getPassSecret(env = process.env) {
  const secret = env.QR_PASS_SECRET;
  if (!secret) {
    throw new MemberPassError('QR_PASS_SECRET is required to issue member passes.');
  }
  return secret;
}

function signature(userId, qrVersion, secret) {
  return createHmac('sha256', secret).update(`${userId}:${qrVersion}`).digest('hex');
}

/**
 * Build the QR payload for a member.
 * @param {{ id: string, qrVersion?: number }} user
 */
export function buildMemberPass(user, options = {}) {
  const userId = String(user?.id ?? '').trim();
  if (!userId) {
    throw new MemberPassError('A member id is required to issue a pass.');
  }
  const qrVersion = Number(user?.qrVersion ?? 1);
  const secret = options.secret ?? getPassSecret(options.env);
  return `${userId}:${qrVersion}:${signature(userId, qrVersion, secret)}`;
}

/**
 * Parse a scanned pass without verifying it. Returns null when the value is not
 * a well-formed pass, so callers can reject unreadable codes before any lookup.
 */
export function parseMemberPass(value) {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(':');
  if (parts.length !== 3) return null;

  const [userId, rawVersion, providedSignature] = parts;
  const qrVersion = Number(rawVersion);
  if (!userId || !Number.isInteger(qrVersion) || qrVersion < 1) return null;
  if (!/^[0-9a-f]{64}$/i.test(providedSignature)) return null;

  return { userId, qrVersion, signature: providedSignature };
}

/**
 * Verify a parsed pass against the member's current qrVersion.
 * Fails when the signature is forged OR when the pass predates a reset.
 *
 * @param {{ userId: string, qrVersion: number, signature: string }} parsed
 * @param {number} currentQrVersion  qrVersion currently stored on the account.
 */
export function verifyMemberPass(parsed, currentQrVersion, options = {}) {
  if (!parsed) return false;
  // A pass issued before a "reset my pass" must stop working.
  if (Number(parsed.qrVersion) !== Number(currentQrVersion)) return false;

  const secret = options.secret ?? getPassSecret(options.env);
  const expected = Buffer.from(signature(parsed.userId, parsed.qrVersion, secret), 'hex');
  const provided = Buffer.from(parsed.signature, 'hex');
  if (expected.length !== provided.length || expected.length === 0) return false;
  return timingSafeEqual(expected, provided);
}

export function isMemberPassError(error) {
  return error instanceof MemberPassError;
}
