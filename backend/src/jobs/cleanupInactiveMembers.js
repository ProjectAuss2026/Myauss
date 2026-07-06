import cron from 'node-cron';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';

// Default retention window for INACTIVE (never-paid) member accounts.
// Overridable via MEMBERSHIP_INACTIVE_RETENTION_DAYS. Confirm hard-delete vs
// soft-delete + this window with the committee (privacy — KAN-104).
const DEFAULT_RETENTION_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getRetentionDays() {
  const parsed = Number(process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETENTION_DAYS;
  }
  return Math.floor(parsed);
}

/**
 * Hard-delete member accounts that have sat INACTIVE for longer than the
 * retention window. Keyed on `membershipStatusUpdatedAt` (not `createdAt`) so a
 * VERIFIED member later set back to INACTIVE gets a fresh window rather than
 * being deleted immediately; a fresh registration's timestamp equals its
 * createdAt, so it is removed ~`retentionDays` after sign-up. NEED_REVIEW and
 * VERIFIED accounts are never touched. Child rows (info, sessions, audit) are
 * removed by the schema's onDelete cascades.
 *
 * @param {Date} [now] Injectable clock for tests.
 * @returns {Promise<number>} Count of accounts deleted.
 */
export async function cleanupInactiveMembers(now = new Date()) {
  const retentionDays = getRetentionDays();
  const cutoff = new Date(now.getTime() - retentionDays * MS_PER_DAY);

  const result = await prisma.user.deleteMany({
    where: {
      membershipStatus: 'INACTIVE',
      membershipStatusUpdatedAt: { lt: cutoff },
    },
  });

  if (result.count > 0) {
    logger.info(
      { count: result.count, retentionDays, cutoff },
      'Cleaned up stale INACTIVE member accounts',
    );
  }

  return result.count;
}

// Runs daily at 03:15. Separate from the hourly email-verification cleanup.
// Skipped under test so importing this module for unit tests doesn't leave an
// open cron timer keeping the process alive.
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('15 3 * * *', async () => {
    try {
      await cleanupInactiveMembers();
    } catch (err) {
      logger.error({ err }, '[Cron] Inactive-member cleanup error:');
    }
  });

  logger.info('Inactive-member cleanup job scheduled');
}
