import cron from "node-cron";
import logger from "../utils/logger.js";
import { cleanupExpiredPendingPaymentProofUploads } from "../services/paymentProofUploads.js";

// Payment proof files are sensitive PII. Staged, unlinked uploads expire after
// the configured window and are removed from private storage plus the database.
if (process.env.NODE_ENV !== "test") {
  cron.schedule("10 * * * *", async () => {
    try {
      await cleanupExpiredPendingPaymentProofUploads();
    } catch (err) {
      logger.error({ err }, "[Cron] Pending payment-proof cleanup error:");
    }
  });

  logger.info("Pending payment-proof cleanup job scheduled");
}
