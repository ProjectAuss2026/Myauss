import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';

/**
 * Content types stored in the MemberContent table. Kept as string constants
 * (mirroring the free-form `type` column) rather than a Prisma enum so new perk
 * kinds can be introduced without a migration.
 */
export const MEMBER_CONTENT_TYPE = Object.freeze({
  DISCOUNT_CODE: 'DISCOUNT_CODE',
  EXCLUSIVE_CONTENT: 'EXCLUSIVE_CONTENT',
  PRIVATE_LINK: 'PRIVATE_LINK',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
});

// `metadata` is a free-form JSON column; normalise to a plain object so the
// shape helpers below can read keys without null-guarding every access.
function metaOf(row) {
  return row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
}

// Map a raw MemberContent row into the client-facing shape for each section.
// The frontend renders these fields directly, so the mapping lives here (not in
// the component) — the browser never sees a row it isn't entitled to.
function toDiscountCode(row) {
  const meta = metaOf(row);
  return {
    id: row.id,
    sponsor: row.title,
    discount: row.body,
    code: row.code ?? '',
    tier: meta.tier ?? null,
  };
}

function toExclusiveContent(row) {
  const meta = metaOf(row);
  return {
    id: row.id,
    title: row.title,
    description: row.body,
    tag: meta.tag ?? null,
    url: row.url ?? null,
  };
}

function toPrivateLink(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.body || null,
    url: row.url ?? '',
  };
}

function toAnnouncement(row) {
  const meta = metaOf(row);
  return {
    id: row.id,
    title: row.title,
    content: row.body,
    // Real timestamp column so the client can format/relative-date it; the old
    // hardcoded version shipped a pre-formatted string.
    publishedAt: row.publishedAt,
    isNew: meta.isNew === true,
  };
}

/**
 * GET /api/member/content — VERIFIED members only.
 *
 * Enforced upstream by `authenticate` + `requireVerifiedMembership`, so this
 * handler is only ever reached with an active member (or ADMIN/OWNER). It returns
 * every active members-only perk grouped by section. The `visibility = MEMBERS`
 * filter is applied in the query itself: these rows are never emitted by any
 * public route, which is the authoritative control this story adds (KAN-167 AC2).
 */
export const getMemberContent = async (req, res) => {
  try {
    const rows = await prisma.memberContent.findMany({
      where: { visibility: 'MEMBERS', isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { publishedAt: 'desc' }],
    });

    const grouped = {
      discountCodes: [],
      exclusiveContent: [],
      privateLinks: [],
    };

    for (const row of rows) {
      switch (row.type) {
        case MEMBER_CONTENT_TYPE.DISCOUNT_CODE:
          grouped.discountCodes.push(toDiscountCode(row));
          break;
        case MEMBER_CONTENT_TYPE.EXCLUSIVE_CONTENT:
          grouped.exclusiveContent.push(toExclusiveContent(row));
          break;
        case MEMBER_CONTENT_TYPE.PRIVATE_LINK:
          grouped.privateLinks.push(toPrivateLink(row));
          break;
        default:
          // Unknown/legacy types (e.g. ANNOUNCEMENT, handled elsewhere) are
          // ignored rather than leaked into an unexpected section.
          break;
      }
    }

    return res.json(grouped);
  } catch (err) {
    logger.error({ err }, 'getMemberContent error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/announcements — PUBLIC dashboard announcements.
 *
 * Announcements are non-sensitive club updates shown to every dashboard visitor
 * (verified or not), so unlike getMemberContent this handler is intentionally
 * NOT gated behind `requireVerifiedMembership` — it is a public route. The
 * `visibility = PUBLIC` filter in the query guarantees no members-only row is
 * ever served here, mirroring the members-only filter on getMemberContent.
 */
export const getAnnouncements = async (_req, res) => {
  try {
    const rows = await prisma.memberContent.findMany({
      where: {
        type: MEMBER_CONTENT_TYPE.ANNOUNCEMENT,
        visibility: 'PUBLIC',
        isActive: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { publishedAt: 'desc' }],
    });

    return res.json(rows.map(toAnnouncement));
  } catch (err) {
    logger.error({ err }, 'getAnnouncements error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};
