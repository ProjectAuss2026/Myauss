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
const BREVO_TIMEOUT_MS = 10_000;

export function parseFrom(fromValue) {
  // Accept "AUSS <email@x>" or a bare "email@x".
  const trimmed = String(fromValue || "").trim();
  const match = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || "AUSS", email: match[2].trim() };
  }
  return { name: "AUSS", email: trimmed };
}

/**
 * Pure provider selection: "brevo" | "smtp" | "none". Exported for tests and
 * used by isEmailConfigured()/sendProviderEmail() so the routing logic has
 * exactly one source of truth.
 */
export function pickEmailProvider({ brevoApiKey, smtpUser, smtpPass }) {
  if (brevoApiKey) return "brevo";
  if (smtpUser && smtpPass) return "smtp";
  return "none";
}

/**
 * True when at least one email provider is configured (Brevo API key or
 * SMTP credentials). Callers use this to skip/flag sends in local dev.
 */
export function isEmailConfigured() {
  return pickEmailProvider({
    brevoApiKey: process.env.BREVO_API_KEY,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
  }) !== "none";
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

async function sendViaBrevo({ from, to, subject, text, html }, fetchImpl = fetch) {
  const sender = parseFrom(
    from || process.env.BREVO_SENDER_EMAIL || "",
  );

  // Fail fast with a clear config error instead of letting Brevo reject an
  // unverified/placeholder sender with an opaque API error at runtime.
  if (!sender.email || sender.email.endsWith("@example.com")) {
    throw new Error(
      "Brevo sender is not configured: set BREVO_SENDER_EMAIL (verified in Brevo) or pass `from`.",
    );
  }

  const payload = {
    sender: { name: sender.name, email: sender.email },
    to: [{ email: String(to || "").trim() }],
    subject: String(subject || ""),
  };
  if (text) payload.textContent = String(text);
  if (html) payload.htmlContent = String(html);

  const response = await fetchImpl(BREVO_API_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    // fetch() has no default timeout in Node; without this a hung Brevo
    // connection would hang the registration request / cron job with it.
    signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Use Brevo's own structured `message` field only — never embed the raw
    // response body, which could carry fields that pino's redaction (path
    // matching, not free-text) would not censor (KAN-99).
    let reason = "";
    try {
      const body = await response.json();
      if (body?.message) reason = `: ${String(body.message).slice(0, 200)}`;
    } catch {
      // Non-JSON error body — omit details.
    }
    throw new Error(`Brevo API error ${response.status}${reason}`);
  }
}

/**
 * Deliver one email via the configured provider (Brevo HTTPS API first,
 * SMTP fallback). `message` mirrors nodemailer's shape:
 * { from, to, subject, text?, html? }. Throws on delivery failure.
 */
export async function sendProviderEmail(
  { from, to, subject, text, html },
  _deps = {},
) {
  if (process.env.BREVO_API_KEY) {
    await sendViaBrevo({ from, to, subject, text, html }, _deps.fetchImpl || fetch);
    return;
  }

  const sendMail =
    _deps.smtpSendMail || getSmtpTransporter().sendMail.bind(getSmtpTransporter());
  await sendMail({
    from: from || process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}
