import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import '../env.js';
import prisma from '../prismaClient.js';
import { authenticate } from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { loginSchema, registerSchema, resendCodeSchema, verifySchema } from '../schemas/authSchemas.js';
import { hashStudentId, isStudentIdHashError } from '../utils/studentIdHash.js';
import logger from '../utils/logger.js';
import {
  forgotPasswordEmailThrottle,
  forgotPasswordIpLimiter,
  loginEmailThrottle,
  loginIpLimiter,
  registerEmailThrottle,
  registerIpLimiter,
  resendEmailThrottle,
  resendIpLimiter,
  verifyEmailThrottle,
  verifyIpLimiter,
} from '../middleware/rateLimiters.js';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
  clearRefreshCookie,
  hashToken,
  readCookie,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/authTokens.js';
import { normalizePassword, validatePasswordPolicy } from '../utils/passwordPolicy.js';
import { validateEmailDeliverability, parseAllowlist } from '../utils/emailDeliverability.js';

const router = Router();
const SALT_ROUNDS = 10;
const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;
const INVITATION_WINDOW_HOURS = 72;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_RE = /^\d{6}$/;
const DUMMY_PASSWORD_HASH = '$2b$10$/xqJwWT1Q9PUG36E3VFDaeaEj38BottPAIiqzxB22NLIrCGpnFLem';
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const REGISTER_GENERIC_MESSAGE = 'If your email is eligible, a verification code has been sent.';
const RESEND_GENERIC_MESSAGE = 'If your email has a pending verification, a new code has been sent.';
const LOGIN_GENERIC_ERROR = 'Invalid email or password.';
const FORGOT_PASSWORD_GENERIC_MESSAGE = 'If your email is registered, a password reset link has been sent.';
const RESET_TOKEN_ERROR = 'Invalid or expired password reset token.';

function getOtpPepper() {
  return process.env.OTP_PEPPER || process.env.JWT_SECRET || '';
}

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
function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashVerificationCode(code) {
  return crypto.createHmac('sha256', getOtpPepper()).update(String(code)).digest('hex');
}

function timingSafeCodeMatch(expectedHash, code) {
  try {
    const providedHash = hashVerificationCode(code);
    const expected = Buffer.from(expectedHash, 'hex');
    const provided = Buffer.from(providedHash, 'hex');
    if (expected.length === 0 || expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getAuthTestHooks() {
  return process.env.NODE_ENV === 'test' ? globalThis.__AUSS_AUTH_TEST_HOOKS__ ?? null : null;
}

function parseInviteHours(value) {
  if (value === undefined || value === null || value === '') return INVITATION_WINDOW_HOURS;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 168) {
    return null;
  }
  return parsed;
}

function isOwner(req) {
  return req.user?.role === 'OWNER';
}

async function getInviteeEligibility(invitedEmail) {
  const invitee = await prisma.user.findUnique({
    where: { email: invitedEmail },
    include: { info: true },
  });

  if (!invitee) {
    return { status: 404, error: 'No registered user found for this email' };
  }
  if (!invitee.isVerified) {
    return { status: 409, error: 'User must verify their email before receiving admin invitation' };
  }
  if (invitee.role !== 'USER') {
    return { status: 409, error: `User already has ${invitee.role} role` };
  }

  return { invitee };
}

async function sendVerificationCode(user) {
  // MX deliverability check before sending — fails fast if domain can't receive mail.
  // Trade-off: this reveals domain MX status on register (low risk — anyone can do MX lookup).
  const emailCheck = await validateEmailDeliverability(user.email, {
    allowlist: parseAllowlist(process.env.EMAIL_MX_ALLOWLIST),
  });
  if (!emailCheck.deliverable) {
    return { sent: false, error: 'This email address does not appear to be deliverable. Please check for typos.' };
  }

  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(code);
  const now = Date.now();
  await prisma.otpCode.upsert({
    where: { userId: user.id },
    update: {
      codeHash,
      expiresAt: new Date(now + VERIFICATION_WINDOW_MS),
      attemptsRemaining: OTP_MAX_ATTEMPTS,
      consumedAt: null,
    },
    create: {
      userId: user.id,
      codeHash,
      expiresAt: new Date(now + VERIFICATION_WINDOW_MS),
      attemptsRemaining: OTP_MAX_ATTEMPTS,
    },
  });

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[OTP DEV] Verification code generated for ${user.email}. SMTP is not configured.`);
    return { sent: true };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
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
  return { sent: true };
}

function buildResetUrl(token) {
  const appUrl = (process.env.APP_URL || 'http://localhost:5174').replace(/\/+$/, '');
  return `${appUrl}/reset?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = buildResetUrl(token);
  const testHooks = getAuthTestHooks();

  if (testHooks?.sendPasswordResetEmail) {
    await testHooks.sendPasswordResetEmail({ email, token, resetUrl });
    return;
  }

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

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.info?.firstName || null,
    lastName: user.info?.lastName || null,
    studentId: null,
  };
}

async function issueTokensForUser(res, user, existingSessionId = null) {
  const sessionId = existingSessionId || crypto.randomUUID();
  const refreshToken = signRefreshToken(user, sessionId);
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  if (existingSessionId) {
    await prisma.authSession.update({
      where: { id: existingSessionId },
      data: {
        refreshTokenHash,
        expiresAt,
        lastUsedAt: new Date(),
        revokedAt: null,
        revokedReason: null,
      },
    });
  } else {
    await prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        expiresAt,
      },
    });
  }

  setRefreshCookie(res, refreshToken);
  return signAccessToken(user);
}

function getRefreshTokenFromRequest(req) {
  return readCookie(req, REFRESH_COOKIE_NAME);
}

// ── POST /auth/register ─────────────────────────────────────────────
router.post('/register', registerIpLimiter, registerEmailThrottle, validate(registerSchema), async (req, res) => {
  try {
    const { email, password, firstName, lastName, studentId } = req.body;
    const normalisedEmail = normaliseEmail(email);

    const passwordPolicy = validatePasswordPolicy(password, [normalisedEmail, firstName, lastName, studentId]);
    if (!passwordPolicy.ok) {
      return res.status(400).json({ error: passwordPolicy.error });
    }

    const studentIdHash = hashStudentId(studentId);

    const existing = await prisma.user.findUnique({ where: { email: normalisedEmail } });

    // Already verified — keep the response generic to avoid email enumeration.
    if (existing?.isVerified) {
      return res.status(200).json({ message: REGISTER_GENERIC_MESSAGE });
    }

    // Exists but unverified — update password, always force USER role
    if (existing && !existing.isVerified) {
      const passwordHash = await bcrypt.hash(passwordPolicy.normalizedPassword, SALT_ROUNDS);
      const updatedUser = await prisma.user.update({
        where: { email: normalisedEmail },
        data: {
          passwordHash,
          role: 'USER',
          lastCodeSentAt: new Date(),
          verificationExpiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS),
          info: {
            upsert: {
              create: { firstName, lastName, studentId: studentIdHash },
              update: { firstName, lastName, studentId: studentIdHash },
            },
          },
        },
        select: { id: true, email: true },
      });
      const codeResult1 = await sendVerificationCode(updatedUser);
      if (!codeResult1.sent) {
        return res.status(400).json({ error: codeResult1.error });
      }
      return res.status(200).json({
        message: REGISTER_GENERIC_MESSAGE,
      });
    }

    // Brand new user
    const passwordHash = await bcrypt.hash(passwordPolicy.normalizedPassword, SALT_ROUNDS);
    const createdUser = await prisma.user.create({
      data: {
        email: normalisedEmail,
        passwordHash,
        role: 'USER',
        isVerified: false,
        lastCodeSentAt: new Date(),
        verificationExpiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS),
        info: {
          create: { firstName, lastName, studentId: studentIdHash },
        },
      },
      select: { id: true, email: true },
    });

    const codeResult = await sendVerificationCode(createdUser);
    if (!codeResult.sent) {
      return res.status(400).json({ error: codeResult.error });
    }

    return res.status(200).json({
      message: REGISTER_GENERIC_MESSAGE,
    });
  } catch (err) {
    if (isStudentIdHashError(err)) {
      logger.error({ err }, 'Student ID storage configuration error:');
      return res.status(500).json({ error: 'Student ID storage is not configured' });
    }
    logger.error({ err }, 'Register error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /auth/me/info ───────────────────────────────────────────
router.delete('/me/info', authenticate, async (req, res) => {
  try {
    await prisma.userInfo.delete({ where: { userId: req.user.id } });
    return res.status(204).send();
  } catch (err) {
    if (err?.code === 'P2025') {
      return res.status(204).send();
    }
    logger.error({ err }, 'Delete user info error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/forgot-password ─────────────────────────────────────
router.post('/forgot-password', forgotPasswordIpLimiter, forgotPasswordEmailThrottle, async (req, res) => {
  try {
    const normalisedEmail = normaliseEmail(req.body?.email);
    if (!normalisedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

    if (user?.isVerified) {
      const now = new Date();
      const activeReset = await prisma.passwordReset.findFirst({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });

      if (!activeReset) {
        const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
        const tokenHash = hashToken(token);
        const createdReset = await prisma.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(now.getTime() + RESET_TOKEN_WINDOW_MS),
          },
          select: { id: true },
        });

        try {
          await sendPasswordResetEmail(user.email, token);
        } catch (emailError) {
          await prisma.passwordReset.deleteMany({
            where: {
              id: createdReset.id,
              usedAt: null,
            },
          });
          logger.error({ err: emailError, userId: user.id }, 'Password reset email error:');
        }
      }
    }

    return res.status(200).json({ message: FORGOT_PASSWORD_GENERIC_MESSAGE });
  } catch (err) {
    logger.error({ err }, 'Forgot-password error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/reset-password ──────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = req.body?.newPassword;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const tokenHash = hashToken(token);
    const reset = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: { include: { info: true } } },
    });

    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      return res.status(400).json({ error: RESET_TOKEN_ERROR });
    }

    const passwordPolicy = validatePasswordPolicy(newPassword, [
      reset.user.email,
      reset.user.info?.firstName,
      reset.user.info?.lastName,
      reset.user.info?.studentId,
    ]);
    if (!passwordPolicy.ok) {
      return res.status(400).json({ error: passwordPolicy.error });
    }

    const passwordHash = await bcrypt.hash(passwordPolicy.normalizedPassword, SALT_ROUNDS);
    const usedAt = new Date();

    const consumed = await prisma.$transaction(async (tx) => {
      const claim = await tx.passwordReset.updateMany({
        where: {
          id: reset.id,
          tokenHash,
          usedAt: null,
          expiresAt: { gt: usedAt },
        },
        data: { usedAt },
      });

      if (claim.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      await tx.authSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: usedAt, revokedReason: 'password_reset' },
      });

      await tx.passwordReset.updateMany({
        where: {
          userId: reset.userId,
          id: { not: reset.id },
          usedAt: null,
        },
        data: { usedAt },
      });

      return true;
    });

    if (!consumed) {
      return res.status(400).json({ error: RESET_TOKEN_ERROR });
    }

    clearRefreshCookie(res);

    try {
      await sendPasswordResetConfirmationEmail(reset.user.email);
    } catch (emailError) {
      logger.error({ err: emailError, userId: reset.userId }, 'Password reset confirmation email error:');
    }

    return res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) {
    logger.error({ err }, 'Reset-password error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/resend-code ──────────────────────────────────────────
router.post('/resend-code', resendIpLimiter, resendEmailThrottle, validate(resendCodeSchema), async (req, res) => {
  try {
    const normalisedEmail = normaliseEmail(req.body?.email);

    const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

    if (user && !user.isVerified) {
      const elapsed = Date.now() - user.lastCodeSentAt.getTime();

      if (elapsed >= RESEND_COOLDOWN_MS) {
        const updatedUser = await prisma.user.update({
          where: { email: normalisedEmail },
          data: {
            lastCodeSentAt: new Date(),
            verificationExpiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS),
          },
          select: { id: true, email: true },
        });
        const codeResult2 = await sendVerificationCode(updatedUser);
        if (!codeResult2.sent) {
          return res.status(400).json({ error: codeResult2.error });
        }
      }
    }

    return res.status(200).json({ message: RESEND_GENERIC_MESSAGE });
  } catch (err) {
    logger.error({ err }, 'Resend-code error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/verify ───────────────────────────────────────────────
router.post('/verify', verifyIpLimiter, verifyEmailThrottle, validate(verifySchema), async (req, res) => {
  try {
    const normalisedEmail = normaliseEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    if (!OTP_RE.test(code)) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalisedEmail },
      include: { info: true, otpCode: true },
    });

    if (!user || user.isVerified) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const now = new Date();
    if (user.verificationExpiresAt <= now) {
      await prisma.otpCode.deleteMany({ where: { userId: user.id } });
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const otpCode = user.otpCode;
    if (!otpCode || otpCode.consumedAt || otpCode.expiresAt <= now || otpCode.attemptsRemaining <= 0) {
      if (otpCode) {
        await prisma.otpCode.deleteMany({ where: { userId: user.id } });
      }
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const isValid = timingSafeCodeMatch(otpCode.codeHash, code);
    if (!isValid) {
      await prisma.otpCode.updateMany({
        where: {
          id: otpCode.id,
          consumedAt: null,
          expiresAt: { gt: now },
          attemptsRemaining: { gt: 0 },
        },
        data: { attemptsRemaining: { decrement: 1 } },
      });

      await prisma.otpCode.deleteMany({
        where: {
          userId: user.id,
          attemptsRemaining: { lte: 0 },
        },
      });

      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const consumed = await prisma.otpCode.updateMany({
      where: {
        id: otpCode.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptsRemaining: { gt: 0 },
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
      include: { info: true },
    });

    await prisma.otpCode.deleteMany({ where: { userId: user.id } });

    const token = await issueTokensForUser(res, verifiedUser);
    return res.status(200).json({
      token,
      user: formatUser(verifiedUser),
    });
  } catch (err) {
    logger.error({ err }, 'Verify error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/login ────────────────────────────────────────────────
router.post('/login', loginIpLimiter, loginEmailThrottle, validate(loginSchema), async (req, res) => {
  try {
    const normalisedEmail = normaliseEmail(req.body?.email);
    const rawPasswordInput = req.body?.password;
    const rawPassword = rawPasswordInput === undefined || rawPasswordInput === null
      ? ''
      : String(rawPasswordInput);
    const normalizedPassword = normalizePassword(rawPassword);
    if (!normalisedEmail || !rawPassword) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: normalisedEmail }, include: { info: true } });
    const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
    let match = await bcrypt.compare(normalizedPassword, passwordHash);
    if (!match && normalizedPassword !== rawPassword) {
      match = await bcrypt.compare(rawPassword, passwordHash);
    }
    if (!user || !match || !user.isVerified) {
      return res.status(401).json({ error: LOGIN_GENERIC_ERROR });
    }

    const token = await issueTokensForUser(res, user);
    return res.status(200).json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    logger.error({ err }, 'Login error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/refresh ──────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    const payload = verifyRefreshToken(refreshToken);
    const userId = payload.sub;
    const sessionId = payload.sid;
    if (!userId || !sessionId) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const [user, session] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, include: { info: true } }),
      prisma.authSession.findUnique({ where: { id: sessionId } }),
    ]);

    if (!user || !session) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session is not valid' });
    }

    if (payload.tv !== user.tokenVersion) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session is no longer valid' });
    }

    const now = new Date();
    const incomingHash = hashToken(refreshToken);
    const expired = session.expiresAt <= now;
    const hashMismatch = session.refreshTokenHash !== incomingHash;
    const revoked = Boolean(session.revokedAt);

    if (session.userId !== user.id || expired || revoked || hashMismatch) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session is not valid' });
    }

    const token = await issueTokensForUser(res, user, session.id);
    return res.status(200).json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Refresh token verification failed:', err instanceof Error ? err.message : err);
    }
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ── POST /auth/logout ───────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const refreshToken = getRefreshTokenFromRequest(req);

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      if (payload?.sid) {
        await prisma.authSession.updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'logout' },
        });
      }
    } catch {
      // Ignore invalid refresh token and still clear cookie.
    }
  }

  clearRefreshCookie(res);
  return res.status(200).json({ message: 'Logged out' });
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
    logger.error({ err }, 'Me error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /auth/admin/users/lookup?email=... ──────────────────────────
router.get('/admin/users/lookup', authenticate, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: 'Only OWNER can look up invitees' });
  }

  const invitedEmail = normaliseEmail(req.query?.email);
  if (!invitedEmail || !EMAIL_RE.test(invitedEmail)) {
    return res.status(400).json({ error: 'A valid invitee email is required' });
  }

  try {
    const result = await getInviteeEligibility(invitedEmail);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    const invitee = result.invitee;
    return res.status(200).json({
      data: {
        id: invitee.id,
        email: invitee.email,
        firstName: invitee.info?.firstName || null,
        lastName: invitee.info?.lastName || null,
        role: invitee.role,
        isVerified: invitee.isVerified,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Lookup invitee error:');
    return res.status(500).json({ error: 'Failed to look up invitee' });
  }
});

// ── GET /auth/admin/users/search?query=... ───────────────────────────
router.get('/admin/users/search', authenticate, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: 'Only OWNER can search invitees' });
  }

  const query = normaliseEmail(req.query?.query);
  if (!query) {
    return res.status(200).json({ data: [] });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        isVerified: true,
        role: 'USER',
        email: {
          contains: query,
          mode: 'insensitive',
        },
      },
      include: { info: true },
      orderBy: { email: 'asc' },
      take: 8,
    });

    return res.status(200).json({
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.info?.firstName || null,
        lastName: user.info?.lastName || null,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Search invitees error:');
    return res.status(500).json({ error: 'Failed to search invitees' });
  }
});

// ── POST /auth/admin/invitations ────────────────────────────────────
router.post('/admin/invitations', authenticate, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: 'Only OWNER can create admin invitations' });
  }

  const invitedEmail = normaliseEmail(req.body?.email);
  const invitedRole = req.body?.role || 'ADMIN';
  const hours = parseInviteHours(req.body?.expiresInHours);
  const reason = req.body?.reason ? String(req.body.reason).trim() : null;

  if (!invitedEmail || !EMAIL_RE.test(invitedEmail)) {
    return res.status(400).json({ error: 'A valid invitee email is required' });
  }
  if (invitedRole !== 'ADMIN') {
    return res.status(400).json({ error: 'Only ADMIN invitations are allowed' });
  }
  if (hours === null) {
    return res.status(400).json({ error: 'expiresInHours must be between 1 and 168' });
  }

  try {
    const inviteeCheck = await getInviteeEligibility(invitedEmail);
    if (inviteeCheck.error) {
      return res.status(inviteeCheck.status).json({ error: inviteeCheck.error });
    }

    const now = new Date();
    await prisma.adminInvitation.updateMany({
      where: {
        invitedEmail,
        invitedRole: 'ADMIN',
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = await prisma.adminInvitation.create({
      data: {
        tokenHash: hashToken(rawToken),
        invitedEmail,
        invitedRole: 'ADMIN',
        invitedByUserId: req.user.id,
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      },
      select: { id: true, invitedEmail: true, invitedRole: true, expiresAt: true },
    });

    return res.status(201).json({
      data: {
        ...invitation,
        reason,
        invitationToken: rawToken,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Create invitation error:');
    return res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// ── POST /auth/admin/invitations/accept ─────────────────────────────
router.post('/admin/invitations/accept', authenticate, async (req, res) => {
  const rawToken = String(req.body?.token || '').trim();
  if (!rawToken) {
    return res.status(400).json({ error: 'Invitation token is required' });
  }

  try {
    const tokenHash = hashToken(rawToken);
    const invitation = await prisma.adminInvitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    if (invitation.revokedAt || invitation.usedAt || invitation.expiresAt <= new Date()) {
      return res.status(410).json({ error: 'Invitation is expired or already used' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { info: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'USER') return res.status(409).json({ error: 'Only USER accounts can accept this invitation' });
    if (normaliseEmail(user.email) !== normaliseEmail(invitation.invitedEmail)) {
      return res.status(403).json({ error: 'Invitation email does not match your account' });
    }

    const now = new Date();
    const updatedUser = await prisma.$transaction(async (tx) => {
      const promoted = await tx.user.update({
        where: { id: user.id },
        data: {
          role: invitation.invitedRole,
          tokenVersion: { increment: 1 },
        },
        include: { info: true },
      });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'role-promoted' },
      });
      await tx.adminInvitation.update({
        where: { id: invitation.id },
        data: {
          usedAt: now,
          acceptedByUserId: user.id,
        },
      });
      await tx.roleChangeAudit.create({
        data: {
          actorUserId: invitation.invitedByUserId,
          targetUserId: user.id,
          fromRole: user.role,
          toRole: invitation.invitedRole,
          reason: 'Invitation accepted',
        },
      });
      return promoted;
    });

    const token = await issueTokensForUser(res, updatedUser);
    return res.status(200).json({
      token,
      user: formatUser(updatedUser),
    });
  } catch (err) {
    logger.error({ err }, 'Accept invitation error:');
    return res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// ── GET /auth/admin/users ───────────────────────────────────────────
router.get('/admin/users', authenticate, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: 'Only OWNER can view access management users' });
  }

  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['OWNER', 'ADMIN'] } },
      include: { info: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    const data = users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      firstName: user.info?.firstName || null,
      lastName: user.info?.lastName || null,
    }));

    return res.status(200).json({ data });
  } catch (err) {
    logger.error({ err }, 'List users error:');
    return res.status(500).json({ error: 'Failed to load users' });
  }
});

// ── POST /auth/admin/users/:userId/promote ──────────────────────────
router.post('/admin/users/:userId/promote', authenticate, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: 'Only OWNER can promote users to admin' });
  }

  const targetUserId = String(req.params.userId || '').trim();
  const reason = req.body?.reason ? String(req.body.reason).trim() : 'Admin promoted by owner';
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user id is required' });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { info: true },
    });

    if (!target) return res.status(404).json({ error: 'Target user not found' });
    if (!target.isVerified) return res.status(409).json({ error: 'User must be verified before promotion' });
    if (target.role !== 'USER') return res.status(409).json({ error: `Only USER can be promoted (current: ${target.role})` });

    const promoted = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.user.update({
        where: { id: target.id },
        data: {
          role: 'ADMIN',
          tokenVersion: { increment: 1 },
        },
        include: { info: true },
      });

      await tx.authSession.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'role-promoted' },
      });

      await tx.adminInvitation.updateMany({
        where: {
          invitedEmail: normaliseEmail(target.email),
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      await tx.roleChangeAudit.create({
        data: {
          actorUserId: req.user.id,
          targetUserId: target.id,
          fromRole: 'USER',
          toRole: 'ADMIN',
          reason,
        },
      });

      return updated;
    });

    return res.status(200).json({ data: formatUser(promoted) });
  } catch (err) {
    logger.error({ err }, 'Promote error:');
    return res.status(500).json({ error: 'Failed to promote user' });
  }
});

// ── POST /auth/admin/users/:userId/demote ───────────────────────────
router.post('/admin/users/:userId/demote', authenticate, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: 'Only OWNER can demote admins' });
  }

  const targetUserId = String(req.params.userId || '').trim();
  const reason = req.body?.reason ? String(req.body.reason).trim() : 'Admin demoted by owner';
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user id is required' });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { info: true },
    });

    if (!target) return res.status(404).json({ error: 'Target user not found' });
    if (target.role !== 'ADMIN') return res.status(409).json({ error: 'Only ADMIN users can be demoted' });

    const now = new Date();
    const demoted = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: target.id },
        data: {
          role: 'USER',
          tokenVersion: { increment: 1 },
        },
        include: { info: true },
      });

      await tx.authSession.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'demoted' },
      });

      await tx.adminInvitation.updateMany({
        where: {
          invitedEmail: normaliseEmail(target.email),
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      await tx.roleChangeAudit.create({
        data: {
          actorUserId: req.user.id,
          targetUserId: target.id,
          fromRole: 'ADMIN',
          toRole: 'USER',
          reason,
        },
      });

      return updated;
    });

    return res.status(200).json({ data: formatUser(demoted) });
  } catch (err) {
    logger.error({ err }, 'Demote error:');
    return res.status(500).json({ error: 'Failed to demote admin' });
  }
});

export default router;
