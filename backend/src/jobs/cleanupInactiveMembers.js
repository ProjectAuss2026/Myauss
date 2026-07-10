import cron from 'node-cron';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { sendMail, escapeHtml } from '../utils/mailer.js';

// Retention policy for INACTIVE member accounts (committee-confirmed, KAN-104):
// an account may sit INACTIVE for at most ~21 days, after which it is
// hard-deleted. The member is warned by email `MEMBERSHIP_INACTIVE_WARNING_DAYS`
// before that, and deletion never happens without a prior warning + grace.
// Applies to ALL inactive accounts, including members whose VERIFIED status
// lapsed at semester end.
const DEFAULT_RETENTION_DAYS = 21;
const DEFAULT_WARNING_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getRetentionDays() {
  const parsed = Number(process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETENTION_DAYS;
  }
  return Math.floor(parsed);
}

// How many days before deletion the warning email is sent (also the minimum
// grace between warning and deletion). Clamped below the retention window so a
// warning is always possible.
export function getWarningDays() {
  const parsed = Number(process.env.MEMBERSHIP_INACTIVE_WARNING_DAYS);
  const retention = getRetentionDays();
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(DEFAULT_WARNING_DAYS, retention);
  }
  return Math.min(Math.floor(parsed), retention);
}

export function buildInactiveWarningEmail({ name, daysUntilDeletion }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'AUSS - Action needed: your membership is inactive';
  const days = daysUntilDeletion;
  const dayWord = days === 1 ? 'day' : 'days';
  const text = `${greeting}

Your AUSS membership is currently inactive. If it stays inactive, your account will be deleted in about ${days} ${dayWord}.

To keep your account, log in and get verified again — you can pay by card or submit a cash/bank-transfer proof from your member dashboard.

If you meant to leave, no action is needed.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#0f172a;margin-top:0;">Auckland Uni Strength Society</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>Your AUSS membership is currently <strong>inactive</strong>. If it stays inactive, your account will be deleted in about <strong>${days} ${dayWord}</strong>.</p>
      <p>To keep your account, log in and get verified again — you can pay by card or submit a cash/bank-transfer proof from your member dashboard.</p>
      <p style="color:#64748b;font-size:14px;">If you meant to leave, no action is needed.</p>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Phase 1 — warn INACTIVE members who are approaching the deletion cutoff and
 * have not yet been warned during this inactive spell. Records `inactiveWarnedAt`
 * so the warning is sent once and provides the grace period before deletion.
 *
 * @param {Date} [now] Injectable clock for tests.
 * @returns {Promise<number>} Count of warning emails attempted.
 */
export async function warnInactiveMembers(now = new Date()) {
  const retentionDays = getRetentionDays();
  const warningDays = getWarningDays();
  const warnCutoff = new Date(now.getTime() - (retentionDays - warningDays) * MS_PER_DAY);

  const due = await prisma.user.findMany({
    where: {
      membershipStatus: 'INACTIVE',
      inactiveWarnedAt: null,
      membershipStatusUpdatedAt: { lt: warnCutoff },
    },
    include: { info: true },
  });

  let warned = 0;
  for (const user of due) {
    const content = buildInactiveWarningEmail({
      name: user.info?.firstName || null,
      daysUntilDeletion: warningDays,
    });
    try {
      await sendMail({ to: user.email, ...content }, 'MEMBERSHIP INACTIVE WARNING');
      await prisma.user.update({
        where: { id: user.id },
        data: { inactiveWarnedAt: now },
      });
      warned += 1;
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send inactive-account warning');
    }
  }

  if (warned > 0) {
    logger.info({ warned, warningDays }, 'Warned inactive members of pending deletion');
  }
  return warned;
}

/**
 * Phase 2 — hard-delete INACTIVE accounts past the retention window that were
 * warned at least `warningDays` ago (so nothing is deleted without a warning and
 * grace period). Child rows are removed by the schema's onDelete cascades.
 *
 * @param {Date} [now] Injectable clock for tests.
 * @returns {Promise<number>} Count of accounts deleted.
 */
export async function deleteInactiveMembers(now = new Date()) {
  const retentionDays = getRetentionDays();
  const warningDays = getWarningDays();
  const deleteCutoff = new Date(now.getTime() - retentionDays * MS_PER_DAY);
  const warnedBefore = new Date(now.getTime() - warningDays * MS_PER_DAY);

  const result = await prisma.user.deleteMany({
    where: {
      membershipStatus: 'INACTIVE',
      membershipStatusUpdatedAt: { lt: deleteCutoff },
      inactiveWarnedAt: { not: null, lt: warnedBefore },
    },
  });

  if (result.count > 0) {
    logger.info(
      { count: result.count, retentionDays },
      'Cleaned up stale INACTIVE member accounts',
    );
  }
  return result.count;
}

// Warn first, then delete — so a member warned in this same run is never also
// deleted in it (the delete phase requires the warning to be `warningDays` old).
export async function runInactiveRetention(now = new Date()) {
  await warnInactiveMembers(now);
  return deleteInactiveMembers(now);
}

// Runs daily at 03:15. Skipped under test so importing this module for unit
// tests doesn't leave an open cron timer keeping the process alive.
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('15 3 * * *', async () => {
    try {
      await runInactiveRetention();
    } catch (err) {
      logger.error({ err }, '[Cron] Inactive-member retention error:');
    }
  });

  logger.info('Inactive-member retention job scheduled');
}
