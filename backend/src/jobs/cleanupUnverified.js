import cron from 'node-cron';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';

/**
 * Runs every hour. Deletes all unverified users whose
 * verificationExpiresAt has passed.
 */
cron.schedule('0 * * * *', async () => {
  try {
    const result = await prisma.user.deleteMany({
      where: {
        isVerified: false,
        verificationExpiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Cleaned up expired unverified users');
    }
  } catch (err) {
    logger.error({ err }, '[Cron] Cleanup error:');
  }
});

logger.info('Unverified-user cleanup job scheduled');
