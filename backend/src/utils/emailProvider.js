import nodemailer from "nodemailer";

// Single email-delivery layer for the whole backend.
//
// Railway blocks outbound SMTP (all ports) on the Hobby plan to protect its
// shared IP reputation — see docs.railway.com/reference/outbound-networking —
// so in production we send through the Brevo transactional-email HTTPS API
// (port 443, never blocked). Local dev keeps the plain SMTP path (Gmail
// app-password etc.) so no account signup is needed to run the app locally.
//
// Priority: BREVO_API_KEY set → Brevo HTTPS API; else SMTP_* → SMTP.
const BREVO_API_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function parseFrom(fromValue) {
  // Accept "AUSS <email@x>" or a bare "email@x".
  const trimmed = String(fromValue || "").trim();
  const match = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || "AUSS", email: match[2].trim() };
  }
  return { name: "AUSS", email: trimmed };
}

/**
 * True when at least one email provider is configured (Brevo API key or
 * SMTP credentials). Callers use this to skip/flag sends in local dev.
 */
export function isEmailConfigured() {
  return Boolean(
    process.env.BREVO_API_KEY ||
      (process.env.SMTP_USER && process.env.SMTP_PASS),
  );
}

let smtpTransporter = null;
function getSmtpTransporter() {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return smtpTransporter;
}

async function sendViaBrevo({ from, to, subject, text, html }) {
  const sender = parseFrom(
    from || process.env.BREVO_SENDER_EMAIL || "AUSS <auss@example.com>",
  );
  const payload = {
    sender: { name: sender.name, email: sender.email },
    to: [{ email: String(to || "").trim() }],
    subject: String(subject || ""),
  };
  if (text) payload.textContent = String(text);
  if (html) payload.htmlContent = String(html);

  const response = await fetch(BREVO_API_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Brevo API error ${response.status}: ${body.slice(0, 300)}`);
  }
}

/**
 * Deliver one email via the configured provider (Brevo HTTPS API first,
 * SMTP fallback). `message` mirrors nodemailer's shape:
 * { from, to, subject, text?, html? }. Throws on delivery failure.
 */
export async function sendProviderEmail({ from, to, subject, text, html }) {
  if (process.env.BREVO_API_KEY) {
    await sendViaBrevo({ from, to, subject, text, html });
    return;
  }

  await getSmtpTransporter().sendMail({
    from: from || process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}
