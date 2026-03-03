/**
 * publicConfig.types.ts
 *
 * Shared TypeScript types for the public configuration payload.
 *
 * WHAT CHANGED (latest):
 * - Added `membership_signup_url` and `media_drive_url` to
 *   PublicConfigCommunications to match the backend contract.
 * - Added `PublicConfigSponsorshipSponsor`, `PublicConfigSponsorship`,
 *   and wired them into the top-level `PublicConfig` interface.
 *
 * WHY THIS EXISTS:
 * The backend will eventually serve a GET /api/public-config endpoint that
 * returns a JSON object containing all publicly-visible site settings (social
 * links, membership info, sponsorship text, etc.). These types define the
 * contract between frontend and backend so both sides stay in sync.
 *
 * HOW BACKEND PLUGS IN:
 * Once the API route is implemented, its response body should conform to
 * `PublicConfig`. The frontend fetcher in `publicConfig.ts` already calls
 * that endpoint — it will "just work" once the route exists.
 */

// ─── Communications / Social Links ──────────────────────────────────────────

/**
 * The social / contact URLs and utility links the site renders.
 * Every field must be a non-empty string from the backend.
 */
export interface PublicConfigCommunications {
  /** Full email address or mailto: URI (e.g. "auss@auckland.ac.nz") */
  email: string;
  /** Instagram profile URL */
  instagram_url: string;
  /** TikTok profile URL */
  tiktok_url: string;
  /** Facebook page URL */
  facebook_url: string;
  /** LinkedIn page URL */
  linkedin_url: string;
  /** Discord server invite URL */
  discord_invite_url: string;
  /** Membership sign-up URL (e.g. a Google Form or portal link) */
  membership_signup_url: string;
  /** Google Drive (or similar) URL for event photos / media */
  media_drive_url: string;
}

// ─── Sponsorship ────────────────────────────────────────────────────────────

/** A single sponsor entry provided by the backend. */
export interface PublicConfigSponsor {
  /** Display name of the sponsor */
  name: string;
  /** Tier label (e.g. "Gold", "Silver", "Bronze") */
  tier: string;
  /** Short description of the sponsorship */
  description: string;
  /** Sponsor's external website URL */
  website: string;
}

/**
 * Page-level content + sponsor list for the Sponsorship page.
 * All copy fields are provided by the backend so marketing can update them
 * without a frontend deploy.
 */
export interface PublicConfigSponsorship {
  /** Hero section title (e.g. "Sponsors & Partners") */
  title: string;
  /** Hero section subtitle */
  subtitle: string;
  /** Body text displayed below the hero */
  body: string;
  /** CTA section heading (e.g. "Become a Sponsor") */
  cta_heading: string;
  /** CTA section body text */
  cta_body: string;
  /** mailto: or external URL the CTA button links to */
  cta_url: string;
  /** Ordered list of sponsors to render as cards */
  sponsors: PublicConfigSponsor[];
}

// ─── Top-level config envelope ──────────────────────────────────────────────

/**
 * Root payload returned by GET /api/public-config.
 * Every block is required — the backend must always provide them all.
 */
export interface PublicConfig {
  communications: PublicConfigCommunications;
  sponsorship: PublicConfigSponsorship;
}
