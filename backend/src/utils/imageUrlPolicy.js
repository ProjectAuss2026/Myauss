import { isAllowedImageUrl } from '../../../shared/securityHeaders.mjs';

export function normalizeOptionalImageUrl(value, fieldName) {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== 'string') {
    return { ok: false, message: `\`${fieldName}\` must be a string or null.` };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (!isAllowedImageUrl(trimmed)) {
    return {
      ok: false,
      message: `\`${fieldName}\` must use a relative upload URL or an origin allowed by CSP_IMAGE_SRC_ORIGINS.`,
    };
  }

  return { ok: true, value: trimmed };
}
