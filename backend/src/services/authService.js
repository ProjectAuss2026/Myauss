import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';
import redis from './redisClient.js';
import { generateCode, sendVerificationEmail } from './emailService.js';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REDIS_TTL = 15 * 60; // 15 minutes in seconds

/**
 * Generate a JWT for a given user.
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Step 2 – Register: hash password, cache in Redis, send verification email.
 */
export async function register(email, password) {
  // Check if user already exists in DB
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw Object.assign(new Error('A user with this email already exists'), { status: 409 });
  }

  // If a registration is already pending, tell the frontend to show the verify step
  const pending = await redis.get(`reg:${email}`);
  if (pending) {
    return {
      message: 'A verification code was already sent. Please check your email.',
      pending: true,
    };
  }

  // Hash the password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Generate a 6-digit code
  const code = generateCode();

  // Store both hash and code in Redis as JSON with a 15-minute TTL
  await redis.set(
    `reg:${email}`,
    JSON.stringify({ passwordHash, code }),
    'EX',
    REDIS_TTL
  );

  // Send the verification email
  await sendVerificationEmail(email, code);

  return { message: 'Verification code sent. Please check your email.' };
}

/**
 * Step 3 – Verify: validate the code stored in Redis, persist user, return JWT.
 */
export async function verifyRegistration(email, code) {
  // Retrieve the cached registration data from Redis
  const raw = await redis.get(`reg:${email}`);
  if (!raw) {
    throw Object.assign(
      new Error('Registration session expired. Please register again.'),
      { status: 410 }
    );
  }

  const { passwordHash, code: storedCode } = JSON.parse(raw);

  // Compare the submitted code with the stored one
  if (code !== storedCode) {
    throw Object.assign(new Error('Invalid verification code'), { status: 400 });
  }

  // Persist the user in the database
  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  // Clean up Redis
  await redis.del(`reg:${email}`);

  // Generate and return JWT
  const token = generateToken(user);
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

/**
 * Step 4 – Login: validate credentials, return JWT.
 */
export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const token = generateToken(user);
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}
