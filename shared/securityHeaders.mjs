const DEFAULT_CSP_IMAGE_SRC_VALUES = Object.freeze([
  "'self'",
  'data:',
  'blob:',
  'https://prodcdn.sporty.co.nz',
  'https://images.squarespace-cdn.com',
  'https://www.lskd.co',
  'https://upload.wikimedia.org',
  'https://nevafoldcollection.com',
  'https://avancus.com',
  'https://assets.shipcode.com',
  'https://images.pixieset.com',
]);

const IMAGE_SOURCE_ENV_KEYS = Object.freeze([
  'CSP_IMAGE_SRC_ORIGINS',
  'VITE_CSP_IMAGE_SRC_ORIGINS',
]);
const DEFAULT_ENV = typeof process === 'undefined' ? {} : process.env;

// Stripe.js + Payment Element require these origins in the page CSP.
const STRIPE_SCRIPT_SRC_VALUES = Object.freeze(['https://js.stripe.com']);
const STRIPE_FRAME_SRC_VALUES = Object.freeze(['https://js.stripe.com', 'https://hooks.stripe.com']);
const STRIPE_CONNECT_SRC_VALUES = Object.freeze(['https://api.stripe.com']);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function splitSourceList(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean);
}

function getHttpOrigin(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : null;
  } catch (_error) {
    return null;
  }
}

function normalizeCspSource(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("'") || trimmed.endsWith(':')) {
    return trimmed;
  }

  return getHttpOrigin(trimmed);
}

function getConfiguredImageSources(env = DEFAULT_ENV) {
  return IMAGE_SOURCE_ENV_KEYS.flatMap((key) => (
    splitSourceList(env[key]).map(normalizeCspSource)
  ));
}

export function getSentryIngestOrigin(env = DEFAULT_ENV) {
  return getHttpOrigin(env.VITE_SENTRY_DSN || env.SENTRY_DSN);
}

export function getConfiguredCspImageSrcValues(env = DEFAULT_ENV) {
  return unique([
    ...DEFAULT_CSP_IMAGE_SRC_VALUES,
    normalizeCspSource(env.UPLOADS_PUBLIC_ORIGIN),
    normalizeCspSource(env.APP_URL),
    ...getConfiguredImageSources(env),
  ]);
}

export function getConfiguredCspConnectSrcValues({
  env = DEFAULT_ENV,
  allowWebSockets = false,
} = {}) {
  return unique([
    "'self'",
    getSentryIngestOrigin(env),
    ...STRIPE_CONNECT_SRC_VALUES,
    ...(allowWebSockets ? ['ws:', 'wss:'] : []),
  ]);
}

export function getConfiguredCspScriptSrcValues() {
  return unique([...STRIPE_SCRIPT_SRC_VALUES]);
}

export function getConfiguredCspFrameSrcValues() {
  return unique([...STRIPE_FRAME_SRC_VALUES]);
}

export function createContentSecurityPolicy({
  env = DEFAULT_ENV,
  allowEval = false,
  allowInlineScripts = false,
  allowWebSockets = false,
} = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' ${getConfiguredCspScriptSrcValues().join(' ')}${allowInlineScripts ? " 'unsafe-inline'" : ''}${allowEval ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https:",
    `img-src ${getConfiguredCspImageSrcValues(env).join(' ')}`,
    "font-src 'self' data: https:",
    `connect-src ${getConfiguredCspConnectSrcValues({ env, allowWebSockets }).join(' ')}`,
    `frame-src ${getConfiguredCspFrameSrcValues().join(' ')}`,
    // The event check-in scanner (KAN-180) runs QR decoding in a worker created
    // from a blob URL. Without an explicit worker-src this falls back to
    // script-src and is blocked. Scoped to workers only — script-src is
    // unchanged, so this does not widen where scripts may be loaded from.
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function sourceAllowsUrl(source, parsedUrl) {
  if (source === `${parsedUrl.protocol}`) {
    return true;
  }

  if (source === parsedUrl.origin) {
    return true;
  }

  return false;
}

export function isAllowedImageUrl(value, env = DEFAULT_ENV) {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return true;
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed);
  } catch (_error) {
    return false;
  }

  const allowedSources = getConfiguredCspImageSrcValues(env);

  if (['data:', 'blob:'].includes(parsedUrl.protocol)) {
    return allowedSources.includes(parsedUrl.protocol);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return false;
  }

  return allowedSources.some((source) => sourceAllowsUrl(source, parsedUrl));
}

export const CSP_IMAGE_SRC_VALUES = getConfiguredCspImageSrcValues();
