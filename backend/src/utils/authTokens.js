import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_ISSUER = process.env.JWT_ISSUER || 'auss-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'auss-web';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export const REFRESH_COOKIE_NAME = 'auss_refresh_token';

if (NODE_ENV !== 'test' && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long.');
}

function parseDurationMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
  return amount * multiplier;
}

export const REFRESH_TOKEN_TTL_MS = parseDurationMs(REFRESH_TOKEN_EXPIRES_IN, 30 * 24 * 60 * 60 * 1000);

const jwtVerifyOptions = {
  algorithms: ['HS256'],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
};

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      tv: user.tokenVersion,
      type: 'access',
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    },
  );
}

export function signRefreshToken(user, sessionId) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      tv: user.tokenVersion,
      sid: sessionId,
      type: 'refresh',
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    },
  );
}

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET, jwtVerifyOptions);
  if (!decoded || typeof decoded !== 'object' || decoded.type !== 'access') {
    throw new Error('Invalid access token.');
  }
  return decoded;
}

export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET, jwtVerifyOptions);
  if (!decoded || typeof decoded !== 'object' || decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token.');
  }
  return decoded;
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
  });
}

export function readCookie(req, cookieName) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const rawPart of parts) {
    const [name, ...rest] = rawPart.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}
