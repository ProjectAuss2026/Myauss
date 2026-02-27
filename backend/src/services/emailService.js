import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generate a random 6-digit verification code.
 */
export function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send a verification code email.
 */
export async function sendVerificationEmail(to, code) {
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'AUSS – Verify your email',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;">
        <h2 style="color:#0f172a;">Verify your AUSS account</h2>
        <p>Your verification code is:</p>
        <div style="font-size:2rem;font-weight:700;letter-spacing:0.3em;color:#38bdf8;padding:1rem 0;">
          ${code}
        </div>
        <p style="color:#64748b;font-size:0.9rem;">
          This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
