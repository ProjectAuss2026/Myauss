import prisma from '../prismaClient.js';
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
