import zxcvbn from 'zxcvbn';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72;
const MIN_STRENGTH_SCORE = 3;

export function normalizePassword(rawPassword) {
  if (rawPassword === undefined || rawPassword === null) return '';
  return String(rawPassword).normalize('NFKC');
}

export function validatePasswordPolicy(rawPassword, userInputs = []) {
  const normalizedPassword = normalizePassword(rawPassword);

  if (!normalizedPassword) {
    return { ok: false, error: 'Password is required' };
  }

  if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  const passwordByteLength = Buffer.from(normalizedPassword, 'utf8').length;
  if (passwordByteLength > MAX_PASSWORD_BYTES) {
    return { ok: false, error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes` };
  }

  const strength = zxcvbn(
    normalizedPassword,
    userInputs
      .filter((value) => value !== undefined && value !== null)
      .map((value) => String(value).trim())
      .filter(Boolean),
  );

  if (strength.score < MIN_STRENGTH_SCORE) {
    return {
      ok: false,
      error: 'Password is too weak. Use a longer, unique passphrase.',
    };
  }

  return { ok: true, normalizedPassword };
}
