import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import prisma from '../prismaClient.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const FORGOT_PASSWORD_MAX_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH = '$2b$10$/xqJwWT1Q9PUG36E3VFDaeaEj38BottPAIiqzxB22NLIrCGpnFLem';
const REGISTER_GENERIC_MESSAGE = 'If your email is eligible, a verification code has been sent.';
const RESEND_GENERIC_MESSAGE = 'If your email has a pending verification, a new code has been sent.';
const LOGIN_GENERIC_ERROR = 'Invalid email or password.';
const FORGOT_PASSWORD_GENERIC_MESSAGE = 'If your email is registered, a password reset link has been sent.';
const RESET_TOKEN_ERROR = 'Invalid or expired password reset token.';

// ── Email transporter (Nodemailer + Gmail SMTP) ─────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── OTP helpers ─────────────────────────────────────────────────────
const pendingCodes = new Map(); // email → code
const forgotPasswordAttempts = new Map(); // ip+email → attempts

async function sendVerificationCode(email) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingCodes.set(email, code);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[OTP DEV] Code for ${email}: ${code}  ← copy this into the verify step`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'AUSS – Your Verification Code',
    text: `Your verification code is: ${code}\n\nThis code expires in 24 hours.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#0f172a;margin-top:0;">Auckland Uni Strength Society</h2>
        <p>Your verification code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#2563eb;margin:16px 0;">${code}</p>
        <p style="color:#64748b;font-size:14px;">This code expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

function verifyCode(email, code) {
  const expected = pendingCodes.get(email);
  if (!expected) return false;
  const valid = expected === code;
  if (valid) pendingCodes.delete(email);
  return valid;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildResetUrl(token) {
  const appUrl = (process.env.APP_URL || 'http://localhost:5174').replace(/\/+$/, '');
  return `${appUrl}/reset?token=${encodeURIComponent(token)}`;
}

function canSendPasswordReset(req, email) {
  const key = crypto
    .createHash('sha256')
    .update(`${req.ip || 'unknown'}:${String(email).toLowerCase()}`)
    .digest('hex');
  const now = Date.now();
  const current = forgotPasswordAttempts.get(key);

  if (!current || now >= current.resetAt) {
    forgotPasswordAttempts.set(key, { count: 1, resetAt: now + FORGOT_PASSWORD_WINDOW_MS });
    return true;
  }

  current.count += 1;
  return current.count <= FORGOT_PASSWORD_MAX_ATTEMPTS;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    return 'Password must be at least 6 characters';
  }

  return null;
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = buildResetUrl(token);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[RESET DEV] Link for ${email}: ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'AUSS – Reset Your Password',
    text: `Reset your password using this link: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#0f172a;margin-top:0;">Auckland Uni Strength Society</h2>
        <p>Use the button below to reset your password. This link expires in 30 minutes.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">Reset password</a></p>
        <p style="color:#64748b;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

async function sendPasswordResetConfirmationEmail(email) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[RESET DEV] Confirmation email skipped for ${email}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'AUSS – Your Password Was Reset',
    text: 'Your AUSS password was reset successfully. If this was not you, please contact the AUSS team immediately.',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#0f172a;margin-top:0;">Auckland Uni Strength Society</h2>
        <p>Your password was reset successfully.</p>
        <p style="color:#64748b;font-size:14px;">If this was not you, please contact the AUSS team immediately.</p>
      </div>
    `,
  });
}

// ── Helper ──────────────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.info?.firstName || null,
    lastName: user.info?.lastName || null,
    studentId: user.info?.studentId || null,
  };
}

// ── POST /auth/register ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, execCode, firstName, lastName, studentId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Determine the user role
    let userRole = 'USER';
    if (role === 'executive') {
      const expectedCode = process.env.EXEC_CODE;
      if (!expectedCode) {
        return res.status(500).json({ error: 'Executive registration is not configured' });
      }
      if (!execCode || String(execCode).trim() !== String(expectedCode).trim()) {
        console.log('[EXEC] Code mismatch — received:', JSON.stringify(execCode), 'expected:', JSON.stringify(expectedCode));
        return res.status(403).json({ error: 'Invalid executive invitation code' });
      }
      userRole = 'ADMIN';
      console.log('[EXEC] Valid exec code — assigning ADMIN role');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Already verified — keep the response generic to avoid email enumeration.
    if (existing && existing.isVerified) {
      return res.status(200).json({ message: REGISTER_GENERIC_MESSAGE });
    }

    // Exists but unverified — update password, send code, redirect to verify
    if (existing && !existing.isVerified) {
      await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          role: userRole,
          lastCodeSentAt: new Date(),
          verificationExpiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS),
          info: {
            upsert: {
              create: { firstName, lastName, studentId },
              update: { firstName, lastName, studentId },
            },
          },
        },
      });
      await sendVerificationCode(email);
      return res.status(200).json({
        message: REGISTER_GENERIC_MESSAGE,
      });
    }

    // Brand new user
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: userRole,
        isVerified: false,
        lastCodeSentAt: new Date(),
        verificationExpiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS),
        info: {
          create: { firstName, lastName, studentId },
        },
      },
    });

    await sendVerificationCode(email);

    return res.status(200).json({
      message: REGISTER_GENERIC_MESSAGE,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/forgot-password ─────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const shouldSend = canSendPasswordReset(req, email);

    if (shouldSend) {
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
        const tokenHash = hashResetToken(token);

        await prisma.$transaction([
          prisma.passwordReset.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
          }),
          prisma.passwordReset.create({
            data: {
              userId: user.id,
              tokenHash,
              expiresAt: new Date(Date.now() + RESET_TOKEN_WINDOW_MS),
            },
          }),
        ]);

        try {
          await sendPasswordResetEmail(user.email, token);
        } catch (emailError) {
          console.error('Password reset email error:', emailError);
        }
      }
    }

    return res.status(200).json({ message: FORGOT_PASSWORD_GENERIC_MESSAGE });
  } catch (err) {
    console.error('Forgot-password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/reset-password ──────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const reset = await prisma.passwordReset.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      return res.status(400).json({ error: RESET_TOKEN_ERROR });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const usedAt = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt },
      }),
      prisma.passwordReset.updateMany({
        where: {
          userId: reset.userId,
          id: { not: reset.id },
          usedAt: null,
        },
        data: { usedAt },
      }),
    ]);

    try {
      await sendPasswordResetConfirmationEmail(reset.user.email);
    } catch (emailError) {
      console.error('Password reset confirmation email error:', emailError);
    }

    return res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset-password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/resend-code ──────────────────────────────────────────
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && !user.isVerified) {
      const elapsed = Date.now() - user.lastCodeSentAt.getTime();

      if (elapsed >= RESEND_COOLDOWN_MS) {
        await sendVerificationCode(email);

        await prisma.user.update({
          where: { email },
          data: { lastCodeSentAt: new Date() },
        });
      }
    }

    return res.status(200).json({ message: RESEND_GENERIC_MESSAGE });
  } catch (err) {
    console.error('Resend-code error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/verify ───────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const isValid = verifyCode(email, code);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const user = await prisma.user.update({
      where: { email },
      data: { isVerified: true },
      include: { info: true },
    });

    const token = generateToken(user);
    return res.status(200).json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/login ────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { info: true } });
    const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
    const match = await bcrypt.compare(password, passwordHash);

    if (!user || !match || !user.isVerified) {
      return res.status(401).json({ error: LOGIN_GENERIC_ERROR });
    }

    const token = generateToken(user);
    return res.status(200).json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /auth/me ────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { info: true } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({
      user: formatUser(user),
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
