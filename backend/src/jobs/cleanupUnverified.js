import cron from 'node-cron';
import prisma from '../prismaClient.js';

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
      console.log(`[Cron] Cleaned up ${result.count} expired unverified user(s)`);
    }
  } catch (err) {
    console.error('[Cron] Cleanup error:', err);
  }
});

console.log('[Cron] Unverified-user cleanup job scheduled (every hour)');
