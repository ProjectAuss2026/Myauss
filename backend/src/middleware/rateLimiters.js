import rateLimit from 'express-rate-limit';

const MAX_SOFT_THROTTLE_BUCKETS = 10000;
const MAX_CONCURRENT_DELAYED_REQUESTS = 500;

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getRetryAfterSeconds(req) {
  const resetTime = req.rateLimit?.resetTime;
  if (!resetTime) return null;
  return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
}

function build429Handler(scope) {
  return (req, res) => {
    const retryAfterSeconds = getRetryAfterSeconds(req);
    if (retryAfterSeconds) {
      res.set('Retry-After', String(retryAfterSeconds));
    }
    return res.status(429).json({
      error: `Too many requests for ${scope}. Please try again later.`,
      retryAfterSeconds,
    });
  };
}

function createLimiter({
  windowMs,
  max,
  keyGenerator,
  scope,
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: (req) => req.method === 'OPTIONS',
    handler: build429Handler(scope),
  });
}

function createEmailSoftThrottle({
  windowMs,
  threshold,
  baseDelayMs,
  maxDelayMs,
  keyGenerator,
}) {
  const requestBuckets = new Map();
  let requestCount = 0;
  let delayedRequestCount = 0;

  return (req, res, next) => {
    const key = keyGenerator(req);
    if (!key || key.endsWith(':unknown')) {
      return next();
    }

    const now = Date.now();
    const bucket = requestBuckets.get(key);
    if (!bucket && requestBuckets.size >= MAX_SOFT_THROTTLE_BUCKETS) {
      const oldestKey = requestBuckets.keys().next().value;
      if (oldestKey) {
        requestBuckets.delete(oldestKey);
      }
    }
    let count = 0;
    let resetAt = now + windowMs;
    if (bucket && now < bucket.resetAt) {
      count = bucket.count;
      resetAt = bucket.resetAt;
    }
    count += 1;
    if (requestBuckets.has(key)) {
      requestBuckets.delete(key);
    }
    requestBuckets.set(key, { count, resetAt, lastSeenAt: now });

    const excess = Math.max(0, count - threshold);
    const delayMs = Math.min(maxDelayMs, excess * baseDelayMs);

    requestCount += 1;
    if (requestCount % 200 === 0) {
      const staleBefore = now - windowMs * 2;
      for (const [bucketKey, bucketValue] of requestBuckets.entries()) {
        if (bucketValue.lastSeenAt < staleBefore) {
          requestBuckets.delete(bucketKey);
        }
      }
    }

    if (delayMs <= 0) {
      return next();
    }

    if (delayedRequestCount >= MAX_CONCURRENT_DELAYED_REQUESTS) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
      });
    }

    delayedRequestCount += 1;
    let settled = false;

    let timeout = null;
    const settle = () => {
      if (settled) return;
      settled = true;
      delayedRequestCount = Math.max(0, delayedRequestCount - 1);
    };
    const onClose = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      settle();
    };

    req.once('close', onClose);
    timeout = setTimeout(() => {
      req.off('close', onClose);
      if (req.aborted || req.destroyed) {
        settle();
        return;
      }
      settle();
      next();
    }, delayMs);
  };
}

export const globalApiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  scope: 'the API',
});

export const loginIpLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  scope: 'login',
});

export const loginEmailThrottle = createEmailSoftThrottle({
  windowMs: 60 * 60 * 1000,
  threshold: 20,
  baseDelayMs: 150,
  maxDelayMs: 2000,
  keyGenerator: (req) => `login-email:${normaliseEmail(req.body?.email) || 'unknown'}`,
});

export const registerIpLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  scope: 'registration',
});

export const registerEmailThrottle = createEmailSoftThrottle({
  windowMs: 60 * 1000,
  threshold: 3,
  baseDelayMs: 300,
  maxDelayMs: 2500,
  keyGenerator: (req) => `register-email:${normaliseEmail(req.body?.email) || 'unknown'}`,
});

export const resendIpLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  scope: 'verification resend',
});

export const resendEmailThrottle = createEmailSoftThrottle({
  windowMs: 60 * 1000,
  threshold: 3,
  baseDelayMs: 300,
  maxDelayMs: 2500,
  keyGenerator: (req) => `resend-email:${normaliseEmail(req.body?.email) || 'unknown'}`,
});

export const verifyIpLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  scope: 'verification',
});

export const verifyEmailThrottle = createEmailSoftThrottle({
  windowMs: 60 * 1000,
  threshold: 6,
  baseDelayMs: 250,
  maxDelayMs: 2500,
  keyGenerator: (req) => `verify-email:${normaliseEmail(req.body?.email) || 'unknown'}`,
});

export const uploadUserLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `upload-user:${req.user?.id || 'unknown'}`,
  scope: 'file upload',
});
