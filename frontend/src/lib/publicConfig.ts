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
    email: 'auss@auckland.ac.nz',
    instagram_url: 'https://instagram.com/auss.uoa',
    tiktok_url: 'https://tiktok.com/@auss.uoa',
    facebook_url: 'https://facebook.com/auss.uoa',
    linkedin_url: 'https://linkedin.com/company/auss-uoa',
    discord_invite_url: 'https://discord.gg/auss',
    membership_signup_url: 'https://example.com/membership',
    media_drive_url: 'https://drive.google.com',
  },
  sponsorship: {
    title: 'Sponsors & Partners',
    subtitle: 'Our Partners',
    body: 'AUSS is proudly supported by these amazing brands and organisations. Their support helps us train, compete, and grow as a community.',
    cta_heading: 'Become a Sponsor',
    cta_body:
      "Interested in supporting Auckland's strongest student community? We offer flexible sponsorship packages to suit your brand.",
    cta_url: 'mailto:auss@auckland.ac.nz?subject=Sponsorship%20Inquiry',
    sponsors: [
      {
        name: 'IronGrip Supplements',
        tier: 'Gold',
        description:
          'Premium sports nutrition partner providing supplements and recovery products for all AUSS members.',
        website: 'https://example.com',
      },
      {
        name: 'LiftWear NZ',
        tier: 'Gold',
        description:
          'Official apparel sponsor outfitting our competition team with high-performance lifting gear.',
        website: 'https://example.com',
      },
      {
        name: 'BarBend Athletics',
        tier: 'Silver',
        description:
          'Equipment sponsor providing competition-grade barbells and plates for our training sessions.',
        website: 'https://example.com',
      },
      {
        name: 'FuelBox Meals',
        tier: 'Silver',
        description:
          'Meal prep partner keeping our athletes fuelled with macro-balanced meals throughout the semester.',
        website: 'https://example.com',
      },
      {
        name: 'UoA Recreation Centre',
        tier: 'Bronze',
        description:
          'Our home gym and venue partner for all AUSS training sessions and internal competitions.',
        website: 'https://example.com',
      },
      {
        name: 'PhysioFirst NZ',
        tier: 'Bronze',
        description:
          'Sports physiotherapy partner offering discounted recovery and injury prevention sessions for members.',
        website: 'https://example.com',
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
