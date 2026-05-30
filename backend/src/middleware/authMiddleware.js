import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/**
 * Middleware that verifies the JWT from the Authorization header.
 * Attaches the decoded payload to `req.user`.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
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
 * Middleware that restricts access to specific roles.
 * Usage: authorise('ADMIN')  or  authorise('ADMIN', 'USER')
 */
export function authorise(...allowedRoles) {
  const middleware = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
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
export function authenticateApi(req, res, next) {
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
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

  middleware.authType = 'authorise';
  middleware.requiredRoles = allowedRoles;
  middleware.requiredRole = allowedRoles.length === 1 ? allowedRoles[0] : undefined;
  return middleware;
}
