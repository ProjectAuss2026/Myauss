import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { verifyAccessToken } from '../utils/authTokens.js';

function hasRoleAccess(userRole, allowedRoles) {
  if (allowedRoles.includes(userRole)) return true;
  // OWNER inherits ADMIN privileges for route guards that require ADMIN.
  if (userRole === 'OWNER' && allowedRoles.includes('ADMIN')) return true;
  return false;
}

async function decodeAndAttachUser(token) {
  const decoded = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, role: true, tokenVersion: true },
  });

  if (!user) throw new Error('User not found.');
  if (decoded.tv !== user.tokenVersion) throw new Error('Token version mismatch.');

  return user;
}

/**
 * Middleware that verifies the JWT from the Authorization header.
 * Attaches a validated { id, role } payload to req.user.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = await decodeAndAttachUser(token);
    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('JWT verification failed:', err instanceof Error ? err.message : err);
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

authenticate.authType = 'authenticate';

/**
 * Optional auth for PUBLIC routes (KAN-171). Attaches req.user when a valid
 * Bearer token is present, and silently continues when it is missing or invalid
 * — it never rejects the request. Used by the public RSVP route so a signed-in
 * member's booking can be linked to their account without making auth required.
 *
 * Deliberately does NOT set `authType`, so routes using it remain classified as
 * public in the route-security assertions (src/security/authRoutes.test.js).
 */
export async function attachUserIfPresent(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const user = await decodeAndAttachUser(authHeader.split(' ')[1]);
    req.user = { id: user.id, role: user.role };
  } catch {
    // Invalid/expired token on a public route is not an error — proceed anonymously.
  }
  return next();
}

/**
 * Middleware that requires an active (VERIFIED) membership. Must run AFTER
 * `authenticate`, which supplies req.user (KAN-178).
 *
 * Deliberately generic — it makes no assumptions about the resource being
 * guarded — so gated-content routes (KAN-167) can reuse it unchanged rather
 * than reimplementing the check.
 *
 * On rejection it returns 403 with a stable machine-readable `code` plus the
 * caller's current status, so the frontend can render the right call-to-action
 * (e.g. link to /verify-membership) without string-matching an error message.
 * ADMIN/OWNER are exempt: staff manage events and must not be locked out of
 * member-facing routes by their own membership state.
 */
export async function requireVerifiedMembership(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Fetched for every caller, including staff, so the account is always
    // stashed on req.user for downstream handlers. Selecting these few extra
    // columns is free — it is the same row either way — and saves the consumer
    // a second lookup of the user it already needs.
    const account = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        email: true,
        membershipStatus: true,
        info: { select: { firstName: true, lastName: true } },
      },
    });

    if (!account) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    req.user.membershipStatus = account.membershipStatus;
    req.user.account = account;

    // Staff run events and must not be locked out by their own membership state.
    if (req.user.role === 'ADMIN' || req.user.role === 'OWNER') {
      return next();
    }

    if (account.membershipStatus !== 'VERIFIED') {
      return res.status(403).json({
        error: 'An active AUSS membership is required.',
        code: 'MEMBERSHIP_REQUIRED',
        membershipStatus: account.membershipStatus,
      });
    }

    return next();
  } catch (err) {
    logger.error(
      { err, userId: req.user.id },
      'requireVerifiedMembership: membership lookup failed',
    );
    return res.status(500).json({ error: 'Internal server error' });
  }
}

requireVerifiedMembership.authType = 'requireVerifiedMembership';

/**
 * Middleware that restricts access to specific roles.
 * Usage: authorise('ADMIN')  or  authorise('ADMIN', 'USER')
 */
export function authorise(...allowedRoles) {
  const middleware = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!hasRoleAccess(req.user.role, allowedRoles)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };

  middleware.authType = 'authorise';
  middleware.requiredRoles = allowedRoles;
  middleware.requiredRole = allowedRoles.length === 1 ? allowedRoles[0] : undefined;
  return middleware;
}

/**
 * API variant of authenticate() that returns a typed error envelope.
 */
export async function authenticateApi(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header.',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = await decodeAndAttachUser(token);
    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('JWT API verification failed:', err instanceof Error ? err.message : err);
    }
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
      },
    });
  }
}

authenticateApi.authType = 'authenticate';

/**
 * API variant of authorise() that returns a typed error envelope.
 */
export function authoriseApi(...allowedRoles) {
  const middleware = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated.',
        },
      });
    }

    if (!hasRoleAccess(req.user.role, allowedRoles)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions.',
        },
      });
    }

    next();
  };

  middleware.authType = 'authorise';
  middleware.requiredRoles = allowedRoles;
  middleware.requiredRole = allowedRoles.length === 1 ? allowedRoles[0] : undefined;
  return middleware;
}
