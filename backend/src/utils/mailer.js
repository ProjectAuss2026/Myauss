import nodemailer from 'nodemailer';
import logger from './logger.js';

// Shared transactional mailer for background jobs (retention warnings, expiry
// notices). The auth controller keeps its own inline transporter for the OTP /
// password-reset / proof-review flows; this mirrors that config so the two
// behave identically. When SMTP is unconfigured (local dev) we log and skip
// instead of throwing, matching the controller's `[... DEV]` fallback.

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
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

  if (!isSmtpConfigured()) {
    logger.info({ to: recipient, context }, `[${context} DEV] Email skipped — SMTP not configured`);
    return { sent: false, skipped: true, reason: 'smtp-not-configured' };
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipient,
    subject,
    text,
    html,
  });
  return { sent: true };
}
