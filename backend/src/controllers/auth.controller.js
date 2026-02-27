import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import prisma from '../prismaClient.js';

const router = Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

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

async function sendVerificationCode(email) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingCodes.set(email, code);

  console.log(`[OTP] Code for ${email}: ${code}`);

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

// ── Helper ──────────────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ── POST /auth/register ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    // Already verified — can't register again
    if (existing && existing.isVerified) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Exists but unverified — update password, send code, redirect to verify
    if (existing && !existing.isVerified) {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          lastCodeSentAt: new Date(),
          verificationExpiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS),
        },
      });
      await sendVerificationCode(email);
      return res.status(200).json({
        message: 'Registration pending. Please verify your email.',
        status: 'PENDING_VERIFICATION',
      });
    }

    // Brand new user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        isVerified: false,
        lastCodeSentAt: new Date(),
        verificationExpiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS),
      },
    });

    await sendVerificationCode(email);

    return res.status(200).json({
      message: 'Verification code sent. Please check your email.',
    });
  } catch (err) {
    console.error('Register error:', err);
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

    if (!user || user.isVerified) {
      return res.status(400).json({ error: 'No pending verification for this email' });
    }

    // Cooldown check
    const elapsed = Date.now() - user.lastCodeSentAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({
        error: `Please wait ${waitSeconds} seconds before requesting a new code`,
      });
    }

    await sendVerificationCode(email);

    await prisma.user.update({
      where: { email },
      data: { lastCodeSentAt: new Date() },
    });

    return res.status(200).json({ message: 'Verification code resent.' });
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
    });

    const token = generateToken(user);
    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in',
        status: 'PENDING_VERIFICATION',
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
