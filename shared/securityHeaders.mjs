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

// The event check-in scanner (KAN-180) decodes QR frames in a worker that
// qr-scanner creates from a blob URL. worker-src falls back to child-src and
// then script-src when unset, and script-src has no blob:, so without this the
// worker is blocked and scanning silently never produces a result.
export function getConfiguredCspWorkerSrcValues() {
  return unique(["'self'", 'blob:']);
}

// The single source of truth for the Content-Security-Policy. The Vite dev and
// preview servers serialize it with createContentSecurityPolicy, and the Express
// app (which serves the built SPA in production) hands the same object to helmet
// with useDefaults: false. Neither side lists directives of its own, so a
// directive added here reaches production without editing anything else — before
// this, each side restated the policy by hand and helmet merged in its own
// defaults, and a directive present only in dev (worker-src, KAN-180) shipped
// broken. Options cover the only intended environment differences.
export function getCspDirectives({
  env = DEFAULT_ENV,
  allowEval = false,
  allowInlineScripts = false,
  allowWebSockets = false,
  // Off by default: Safari upgrades http://localhost requests and breaks the
  // dev and preview servers. The Express app turns it on.
  upgradeInsecureRequests = false,
} = {}) {
  return {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      ...getConfiguredCspScriptSrcValues(),
      ...(allowInlineScripts ? ["'unsafe-inline'"] : []),
      ...(allowEval ? ["'unsafe-eval'"] : []),
    ],
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https:'],
    'img-src': getConfiguredCspImageSrcValues(env),
    'font-src': ["'self'", 'data:', 'https:'],
    'connect-src': getConfiguredCspConnectSrcValues({ env, allowWebSockets }),
    'frame-src': getConfiguredCspFrameSrcValues(),
    // Scoped to workers only — script-src is unchanged, so this does not widen
    // where scripts may be loaded from. See getConfiguredCspWorkerSrcValues.
    'worker-src': getConfiguredCspWorkerSrcValues(),
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    ...(upgradeInsecureRequests ? { 'upgrade-insecure-requests': [] } : {}),
  };
}

export function createContentSecurityPolicy(options = {}) {
  return Object.entries(getCspDirectives(options))
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
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
