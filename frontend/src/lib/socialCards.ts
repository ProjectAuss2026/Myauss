/**
 * socialCards.ts — Maps PublicConfig into an ordered list of social card models.
 *
 * WHY THIS EXISTS:
 * Both the Social page and Footer render the same 6 social cards. This module
 * is the single source of truth for:
 *   - the card order (LinkedIn, Facebook, Instagram, TikTok, Discord, Email)
 *   - per-platform brand colour and CTA label
 *   - per-platform display label / description
 *
 * WHAT CHANGED (latest):
 * - Added `cta` field to SocialCardModel and every platform entry so that
 *   cards can display a contextual call-to-action (e.g. "Follow Us", "Join
 *   Server"). This is used by the reference Social page layout.
 *
 * HOW BACKEND PLUGS IN:
 * Consumers pass in the `communications` block from the fetched config.
 * The mapping is pure — no side-effects, no fetching — so it works equally
 * well with the live backend or the hardcoded fallback.
 */

import type { IconType } from 'react-icons';
import { FaLinkedin, FaFacebook, FaInstagram, FaTiktok, FaDiscord } from 'react-icons/fa';
import { MdEmail } from 'react-icons/md';
import type { PublicConfigCommunications } from './publicConfig.types';

// ─── Card model ──────────────────────────────────────────────────────────────

/** View-model consumed by social card UI components. */
export interface SocialCardModel {
  /** Stable React key */
  key: string;
  /** Human-readable label shown on the card */
  label: string;
  /** Short handle / address displayed beneath the label */
  handle: string;
  /** One-line description for the expanded card variant (Social page) */
  description: string;
  /** The resolved URL the card links to */
  href: string;
  /** react-icons component for this platform */
  icon: IconType;
  /** Hex brand colour used for icon tint & hover effects */
  brandColor: string;
  /** Call-to-action label shown on the card (e.g. "Follow Us") */
  cta: string;
}

// ─── Per-platform metadata (static — doesn't come from backend) ─────────────

interface PlatformMeta {
  key: string;
  label: string;
  /** Returns the display handle from a URL or raw value */
  extractHandle: (url: string) => string;
  description: string;
  icon: IconType;
  brandColor: string;
  /** Call-to-action label (e.g. "Follow Us", "Join Server") */
  cta: string;
  /** Pulls the correct URL out of the config block */
  getHref: (c: PublicConfigCommunications) => string;
}

/**
 * The canonical order of social cards.
 * Changing this array is the ONLY place you need to touch to reorder cards.
 */
const PLATFORM_META: PlatformMeta[] = [
  {
    key: 'linkedin',
    label: 'LinkedIn',
    extractHandle: (url) => extractPathSegment(url) ?? 'LinkedIn',
    description: 'Connect with us professionally and stay updated on career opportunities.',
    icon: FaLinkedin,
    brandColor: '#0A66C2',
    cta: 'Connect',
    getHref: (c) => c.linkedin_url,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    extractHandle: (url) => extractPathSegment(url) ?? 'Facebook',
    description: 'Join our Facebook community for event updates and discussions.',
    icon: FaFacebook,
    brandColor: '#1877F2',
    cta: 'Follow Us',
    getHref: (c) => c.facebook_url,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    extractHandle: (url) => {
      const seg = extractPathSegment(url);
      return seg ? `@${seg}` : '@auss_uoa';
    },
    description: 'Follow us for training content, event updates, and community highlights.',
    icon: FaInstagram,
    brandColor: '#E1306C',
    cta: 'Follow Us',
    getHref: (c) => c.instagram_url,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    extractHandle: (url) => {
      const seg = extractPathSegment(url);
      return seg ? `@${seg.replace(/^@/, '')}` : '@auss_uoa';
    },
    description: 'Watch our latest training clips and behind-the-scenes content.',
    icon: FaTiktok,
    brandColor: '#000000',
    cta: 'Watch Now',
    getHref: (c) => c.tiktok_url,
  },
  {
    key: 'discord',
    label: 'Discord',
    extractHandle: (_url) => 'AUSS Server',
    description: 'Chat with fellow members, find training partners, and get real-time updates.',
    icon: FaDiscord,
    brandColor: '#5865F2',
    cta: 'Join Server',
    getHref: (c) => c.discord_invite_url,
  },
  {
    key: 'email',
    label: 'Email',
    extractHandle: (val) => val.replace(/^mailto:/i, ''),
    description: 'Reach out for any questions, sponsorship enquiries, or general information.',
    icon: MdEmail,
    brandColor: '#eb7524',
    cta: 'Send Email',
    getHref: (c) => {
      // Normalise: accept raw address or full mailto: URI.
      const addr = c.email.replace(/^mailto:/i, '');
      return `mailto:${addr}`;
    },
  },
];

// ─── Mapping function ────────────────────────────────────────────────────────

/**
 * Converts a `PublicConfigCommunications` block into exactly 6
 * ordered `SocialCardModel` entries ready for rendering.
 *
 * Always returns 6 cards regardless of input content.
 */
export function buildSocialCards(comms: PublicConfigCommunications): SocialCardModel[] {
  return PLATFORM_META.map((meta) => {
    const href = meta.getHref(comms);
    return {
      key: meta.key,
      label: meta.label,
      handle: meta.extractHandle(href),
      description: meta.description,
      href,
      icon: meta.icon,
      brandColor: meta.brandColor,
      cta: meta.cta,
    };
  }).filter((card) => card.href);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pull the last non-empty path segment from a URL (e.g. "auss.uoa" from "https://instagram.com/auss.uoa"). */
function extractPathSegment(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? null;
  } catch {
    return null;
  }
}
