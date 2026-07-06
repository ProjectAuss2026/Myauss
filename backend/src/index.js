import "./env.js";
import * as Sentry from "@sentry/node";
import "./jobs/cleanupUnverified.js";
import "./jobs/cleanupInactiveMembers.js";
import "./jobs/cleanupPendingPaymentProofs.js";
import { createApp } from "./app.js";
import logger from "./utils/logger.js";

const sentryDsn = process.env.SENTRY_DSN;
const sentryEnabled = Boolean(sentryDsn);

function getAllowedCorsOrigins() {
  return (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => origin !== "*" && origin.toLowerCase() !== "null");
}

function getSentryTracesSampleRate() {
  const rawSampleRate = process.env.SENTRY_TRACES_SAMPLE_RATE;

  if (rawSampleRate === undefined || rawSampleRate === "") {
    return 0;
  }

  const sampleRate = Number(rawSampleRate);

  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) {
    throw new Error(
      "SENTRY_TRACES_SAMPLE_RATE must be a number between 0 and 1",
    );
  }

  return sampleRate;
}

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || "development",
    integrations: [Sentry.expressIntegration()],
    tracesSampleRate: getSentryTracesSampleRate(),
  });
}

const PORT = process.env.PORT || 3001;
const allowedCorsOrigins = getAllowedCorsOrigins();

logger.info({ port: PORT }, "Environment loaded");
logger.info(
  { configured: Boolean(process.env.DATABASE_URL) },
  "DATABASE_URL configuration checked",
);
logger.info(
  { origins: allowedCorsOrigins },
  "CORS origins allowlist configured",
);

const app = createApp();

if (sentryEnabled) {
  Sentry.setupExpressErrorHandler(app);
}

app.use((error, _req, res, _next) => {
  logger.error({ err: error }, "Unhandled request error");
  res.status(error.status || 500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info({ port: PORT, sentryEnabled }, "Server is running");
});
