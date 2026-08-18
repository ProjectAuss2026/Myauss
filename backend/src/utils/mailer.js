import logger from './logger.js';
import { isEmailConfigured, sendProviderEmail } from './emailProvider.js';

// Shared transactional mailer for background jobs (retention warnings, expiry
// notices). Delivery is routed through utils/emailProvider.js, which prefers
// the Brevo HTTPS API (Railway blocks outbound SMTP on Hobby) and falls back
// to SMTP for local dev. When neither provider is configured (local dev) we
// log and skip instead of throwing.

export function isSmtpConfigured() {
  return isEmailConfigured();
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send one transactional email. Returns a result object rather than throwing so
 * a single bad recipient never aborts a batch job.
 *
 * @param {Object} message
 * @param {string} message.to      Recipient address.
 * @param {string} message.subject
 * @param {string} message.text
 * @param {string} [message.html]
 * @param {string} [context]       Label used in the dev-skip log line.
 * @returns {Promise<{sent: boolean, skipped?: boolean, reason?: string}>}
 */
export async function sendMail({ to, subject, text, html }, context = 'MAIL') {
  const recipient = String(to || '').trim();
  if (!recipient) {
    return { sent: false, skipped: true, reason: 'missing-recipient' };
  }

  if (!isEmailConfigured()) {
    logger.info({ to: recipient, context }, `[${context} DEV] Email skipped — email not configured`);
    return { sent: false, skipped: true, reason: 'email-not-configured' };
  }

  await sendProviderEmail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.BREVO_SENDER_EMAIL,
    to: recipient,
    subject,
    text,
    html,
  });
  return { sent: true };
}
