import cron from 'node-cron';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { sendMail, escapeHtml } from '../utils/mailer.js';
import { changeMembershipStatus } from '../services/membershipStatus.js';

// A VERIFIED membership lasts one semester. After ~91 days it lapses back to
// INACTIVE (which then starts the 21-day inactive-retention clock) and the
// member is emailed to renew. Overridable via MEMBERSHIP_VERIFIED_DURATION_DAYS.
const DEFAULT_VERIFIED_DURATION_DAYS = 91;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRY_REASON = 'Semester ended — membership expired';

export function getVerifiedDurationDays() {
  const parsed = Number(process.env.MEMBERSHIP_VERIFIED_DURATION_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_VERIFIED_DURATION_DAYS;
  }
  return Math.floor(parsed);
}

export function buildMembershipExpiredEmail({ name }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'AUSS - Your membership has expired';
  const text = `${greeting}

Your AUSS membership for this semester has ended, so your account is now inactive.

To continue as a member, log in and get verified again — you can pay by card or submit a cash/bank-transfer proof from your member dashboard.

Please renew within a few weeks to avoid your account being removed.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#0f172a;margin-top:0;">Auckland Uni Strength Society</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>Your AUSS membership for this semester has ended, so your account is now <strong>inactive</strong>.</p>
      <p>To continue as a member, log in and get verified again — you can pay by card or submit a cash/bank-transfer proof from your member dashboard.</p>
      <p style="color:#64748b;font-size:14px;">Please renew within a few weeks to avoid your account being removed.</p>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Transition VERIFIED accounts older than the semester window back to INACTIVE
 * (via the audited transition service) and email each member to renew. Runs one
 * account at a time so every change is individually audited.
 *
 * @param {Date} [now] Injectable clock for tests.
 * @returns {Promise<number>} Count of memberships expired.
 */
export async function expireVerifiedMembers(now = new Date()) {
  const durationDays = getVerifiedDurationDays();
  const cutoff = new Date(now.getTime() - durationDays * MS_PER_DAY);

  const expired = await prisma.user.findMany({
    where: {
      membershipStatus: 'VERIFIED',
      membershipStatusUpdatedAt: { lt: cutoff },
    },
    include: { info: true },
  });

  let count = 0;
  for (const user of expired) {
    try {
      await changeMembershipStatus({
        targetUserId: user.id,
        toStatus: 'INACTIVE',
        actorUserId: null,
        reason: EXPIRY_REASON,
      });
      const content = buildMembershipExpiredEmail({ name: user.info?.firstName || null });
      await sendMail({ to: user.email, ...content }, 'MEMBERSHIP EXPIRED');
      count += 1;
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to expire verified membership');
    }
  }

  if (count > 0) {
    logger.info({ count, durationDays }, 'Expired verified memberships to inactive');
  }
  return count;
}

// Runs daily at 03:30 — after the inactive-retention job. Skipped under test so
// importing this module doesn't leave an open cron timer.
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('30 3 * * *', async () => {
    try {
      await expireVerifiedMembers();
    } catch (err) {
      logger.error({ err }, '[Cron] Verified-membership expiry error:');
    }
  });

  logger.info('Verified-membership expiry job scheduled');
}
