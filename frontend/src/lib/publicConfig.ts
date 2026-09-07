/**
 * publicConfig.ts — Config fetcher with graceful fallback.
 *
 * WHAT CHANGED (latest):
 * - DEFAULT_PUBLIC_CONFIG now includes `membership_signup_url`,
 *   `media_drive_url`, and the full `sponsorship` block with 6 placeholder
 *   sponsors, matching the expanded backend contract.
 * - Shape guards updated to validate the new fields.
 *
 * WHY THIS EXISTS:
 * The Social page, Footer, and Sponsorship page all consume different slices
 * of the same config object. This module centralises the fetch logic so every
 * consumer shares one source of truth.
 *
 * HOW BACKEND PLUGS IN:
 * Implement GET /api/public-config returning a JSON body that matches
 * the `PublicConfig` type. This fetcher will pick it up automatically.
 * Until the route exists, the fetch will 404 and fall back to
 * DEFAULT_PUBLIC_CONFIG so the UI always renders correctly.
 *
 * FALLBACK STRATEGY:
 * - Network error / non-2xx → return null (consumers use default).
 * - Response body doesn't match expected shape → return null.
 * - Any runtime exception → caught, logged, return null.
 */

import type {
  PublicConfig,
  PublicConfigCommunications,
  PublicConfigSponsorship,
} from './publicConfig.types';

// ─── Default / hardcoded fallback ────────────────────────────────────────────

/**
 * Static fallback used whenever the backend is unavailable or returns an
 * invalid payload.
 *
 * TODO: Replace with live data once GET /api/public-config is implemented.
 *       These placeholder values will be superseded by the backend response.
 */
export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  communications: {
    email: 'uoastrengthsociety@gmail.com',
    instagram_url: 'https://www.instagram.com/auss_uoa',
    tiktok_url: 'https://www.tiktok.com/@auss_uoa',
    facebook_url: 'https://www.facebook.com/auss_uoa',
    linkedin_url: 'https://www.linkedin.com/company/auckland-university-strength-society',
    discord_invite_url: '',
    membership_signup_url: '/verify-membership',
    media_drive_url: 'https://danbainvisuals.pixieset.com/auss/landing/',
  },
  sponsorship: {
    title: 'Sponsors & Partners',
    subtitle: 'Our Partners',
    body: 'AUSS is proudly supported by these amazing brands and organisations. Their support helps us train, connect, and grow as a community.',
    cta_heading: 'Become a Sponsor',
    cta_body:
      "Interested in supporting Auckland's strongest student community? We offer flexible sponsorship packages to suit your brand.",
    cta_url: 'mailto:uoastrengthsociety@gmail.com?subject=Sponsorship%20Inquiry',
    sponsors: [
      {
        name: 'Auckland Powerlifting',
        tier: 'Partner',
        description: "Auckland's home for powerlifting, with community, events, and coaching.",
        website: 'https://www.sporty.co.nz/aucklandpowerlifting/home-1',
      },
      {
        name: 'Sisyphus Strength',
        tier: 'Partner',
        description: 'Premium powerlifting coaching and programming.',
        website: 'https://sisyphusstrength.com/',
      },
      {
        name: 'LSKD',
        tier: 'Partner',
        description: 'Activewear and gym apparel for training and beyond.',
        website: 'https://www.lskd.co/',
      },
      {
        name: 'Lorna Jane',
        tier: 'Partner',
        description: "Women's activewear. Move, nourish, believe.",
        website: 'https://www.lornajane.nz/',
      },
      {
        name: 'Neva Fold Collection',
        tier: 'Partner',
        description: 'Streetwear and accessories.',
        website: 'https://nevafoldcollection.com/',
      },
      {
        name: 'Avancus',
        tier: 'Partner',
        description: 'Performance powerlifting shoes.',
        website: 'https://avancus.com/en-nz',
      },
      {
        name: 'Shipcode',
        tier: 'Partner',
        description: 'Shipping and logistics partner.',
        website: 'https://shipcode.com/',
      },
    ],
  },
};

// ─── Runtime shape guards ────────────────────────────────────────────────────

/**
 * Validates that `data` has the shape of `PublicConfigCommunications`.
 * Performs only shallow string checks — enough to catch malformed payloads
 * without pulling in a validation library.
 */
function isValidCommunications(data: unknown): data is PublicConfigCommunications {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.email === 'string' &&
    typeof obj.instagram_url === 'string' &&
    typeof obj.tiktok_url === 'string' &&
    typeof obj.facebook_url === 'string' &&
    typeof obj.linkedin_url === 'string' &&
    typeof obj.discord_invite_url === 'string' &&
    typeof obj.membership_signup_url === 'string' &&
    typeof obj.media_drive_url === 'string'
  );
}

/** Validates the sponsorship block. */
function isValidSponsorship(data: unknown): data is PublicConfigSponsorship {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.title === 'string' &&
    typeof obj.subtitle === 'string' &&
    typeof obj.body === 'string' &&
    typeof obj.cta_heading === 'string' &&
    typeof obj.cta_body === 'string' &&
    typeof obj.cta_url === 'string' &&
    Array.isArray(obj.sponsors)
  );
}

/** Validates the top-level config envelope. */
function isValidConfig(data: unknown): data is PublicConfig {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    isValidCommunications(obj.communications) &&
    isValidSponsorship(obj.sponsorship)
  );
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

/**
 * Fetch the public config from the backend.
 *
 * @returns The validated config, or `null` when the endpoint is missing,
 *          returns an error, or the payload shape is unexpected.
 */
export async function getPublicConfig(): Promise<PublicConfig | null> {
  try {
    // The backend endpoint — not implemented yet; will 404 for now.
    const res = await fetch('/api/public-config', {
      // Prevent stale cache; config changes should be reflected immediately.
      cache: 'no-store',
    });

    if (!res.ok) {
      // Expected to 404 until the backend route is created.
      console.warn(`[publicConfig] fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const json: unknown = await res.json();

    // Runtime guard — never trust untyped JSON.
    if (!isValidConfig(json)) {
      console.warn('[publicConfig] response did not match expected PublicConfig shape', json);
      return null;
    }

    return json;
  } catch (err) {
    // Network errors, JSON parse errors, etc.
    console.warn('[publicConfig] fetch error, falling back to defaults', err);
    return null;
  }
}
