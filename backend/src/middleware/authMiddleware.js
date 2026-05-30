import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

async function verifyAuthToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, JWT_SECRET);
  const userId = decoded.id || decoded.userId;

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, tokenVersion: true },
  });

  if (!user) {
    return null;
  }

  const tokenVersion = Number.isInteger(decoded.tokenVersion) ? decoded.tokenVersion : 0;

  if (tokenVersion !== user.tokenVersion) {
    return null;
  }

  return {
    ...decoded,
    id: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Middleware that verifies the JWT from the Authorization header.
 * Attaches the decoded payload to `req.user`.
 */
export async function authenticate(req, res, next) {
  try {
    const decoded = await verifyAuthToken(req.headers.authorization);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
}

/**
 * Middleware that restricts access to specific roles.
 * Usage: authorise('ADMIN')  or  authorise('ADMIN', 'USER')
 */
export function authorise(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * API variant of authenticate() that returns a typed error envelope.
 */
export async function authenticateApi(req, res, next) {
  try {
    const decoded = await verifyAuthToken(req.headers.authorization);

    if (!decoded) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token.',
        },
      });
    }

    req.user = decoded;
    return next();
  } catch (_err) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
      },
    });
  }
}

/**
 * API variant of authorise() that returns a typed error envelope.
 */
export function authoriseApi(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions.',
        },
      });
    }

    next();
  };
}
