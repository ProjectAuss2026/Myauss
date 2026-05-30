import helmet from 'helmet';

const HSTS_MAX_AGE_SECONDS = 31536000;
const REDIRECT_STATUS = 308;

export function getTrustProxySetting(env = process.env) {
  const rawValue = env.TRUST_PROXY_HOPS ?? env.TRUST_PROXY;
  if (rawValue === undefined || rawValue === '') return 1;

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1;
}

export function isProduction(env = process.env.NODE_ENV) {
  return env === 'production';
}

export function isHttpsRequest(req) {
  const headerValue = req.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const firstProto = typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0].trim().toLowerCase()
    : '';

  return req.secure || firstProto === 'https';
}

export function createHttpsRedirectMiddleware({ env = process.env.NODE_ENV } = {}) {
  return (req, res, next) => {
    if (!isProduction(env) || isHttpsRequest(req)) {
      return next();
    }

    const host = req.headers.host;
    if (!host) return next();

    return res.redirect(REDIRECT_STATUS, `https://${host}${req.originalUrl}`);
  };
}

export function createHelmetMiddleware({ env = process.env.NODE_ENV } = {}) {
  if (!isProduction(env)) {
    return (_req, _res, next) => next();
  }

  return helmet({
    hsts: {
      maxAge: HSTS_MAX_AGE_SECONDS,
      includeSubDomains: true,
      preload: false,
    },
  });
}

export function configureSecurity(app, options = {}) {
  const trustProxy = options.trustProxy ?? getTrustProxySetting(options.envVars);
  const env = options.env ?? process.env.NODE_ENV;

  app.set('trust proxy', trustProxy);
  app.use(createHttpsRedirectMiddleware({ env }));
  app.use(createHelmetMiddleware({ env }));

  return app;
}
