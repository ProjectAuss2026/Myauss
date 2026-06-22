import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';

const PUBLIC_CACHE_HEADER = 'public, max-age=60, stale-while-revalidate=30';

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function parsePositiveInt(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return null;
  return number;
}

function parseUrl(value) {
  try {
    new URL(value);
    return true;
  } catch (_error) {
    return false;
  }
}

function serializeMediaEntry(entry) {
  return {
    id: entry.id,
    activityId: entry.activityId,
    mediaDriveUrl: entry.mediaDriveUrl,
    overrideName: entry.overrideName,
    overrideCover: entry.overrideCover,
    resolvedName: entry.overrideName || entry.activity.title,
    resolvedCover: entry.overrideCover || entry.activity.imageUrl || null,
    activity: {
      id: entry.activity.id,
      title: entry.activity.title,
      imageUrl: entry.activity.imageUrl,
      startTime: entry.activity.startTime,
      endTime: entry.activity.endTime,
      isPublished: entry.activity.isPublished,
    },
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function getMediaEntries(req, res) {
  try {
    const entries = await prisma.mediaEntry.findMany({
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            startTime: true,
            endTime: true,
            isPublished: true,
          },
        },
      },
      orderBy: [{ activity: { startTime: 'desc' } }, { id: 'desc' }],
    });

    const latestTs = entries.reduce((latest, entry) => {
      const ts = entry.updatedAt.getTime();
      return ts > latest ? ts : latest;
    }, 0);
    const etag = `W/"media-entries-${latestTs}-${entries.length}"`;
    res.set('Cache-Control', PUBLIC_CACHE_HEADER);
    res.set('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    return res.status(200).json({ data: entries.map(serializeMediaEntry) });
  } catch (error) {
    logger.error({ err: error }, '[getMediaEntries] Error fetching media entries:');
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch media entries.');
  }
}

export async function createMediaEntry(req, res) {
  const { activityId, mediaDriveUrl, overrideName, overrideCover } = req.body ?? {};

  const parsedActivityId = parsePositiveInt(activityId);
  if (!parsedActivityId) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`activityId` must be a positive integer.');
  }
  if (typeof mediaDriveUrl !== 'string' || !mediaDriveUrl.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`mediaDriveUrl` is required.');
  }
  if (!parseUrl(mediaDriveUrl)) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`mediaDriveUrl` must be a valid absolute URL.');
  }
  if (overrideName !== undefined && overrideName !== null && typeof overrideName !== 'string') {
    return sendError(res, 422, 'VALIDATION_ERROR', '`overrideName` must be a string when provided.');
  }
  if (overrideCover !== undefined && overrideCover !== null && typeof overrideCover !== 'string') {
    return sendError(res, 422, 'VALIDATION_ERROR', '`overrideCover` must be a string when provided.');
  }
  if (typeof overrideCover === 'string' && overrideCover.trim() && !parseUrl(overrideCover.trim())) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`overrideCover` must be a valid absolute URL.');
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: parsedActivityId },
      select: { id: true },
    });
    if (!activity) {
      return sendError(res, 404, 'NOT_FOUND', `Activity ${parsedActivityId} was not found.`);
    }

    const created = await prisma.mediaEntry.create({
      data: {
        activityId: parsedActivityId,
        mediaDriveUrl: mediaDriveUrl.trim(),
        overrideName: typeof overrideName === 'string' && overrideName.trim() ? overrideName.trim() : null,
        overrideCover: typeof overrideCover === 'string' && overrideCover.trim() ? overrideCover.trim() : null,
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            startTime: true,
            endTime: true,
            isPublished: true,
          },
        },
      },
    });

    return res.status(201).json({ data: serializeMediaEntry(created) });
  } catch (error) {
    logger.error({ err: error }, '[createMediaEntry] Error creating media entry:');
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create media entry.');
  }
}

export async function patchMediaEntry(req, res) {
  const entryId = parsePositiveInt(req.params.id);
  if (!entryId) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`id` must be a positive integer.');
  }

  const { activityId, mediaDriveUrl, overrideName, overrideCover } = req.body ?? {};
  const data = {};

  if (activityId !== undefined) {
    const parsedActivityId = parsePositiveInt(activityId);
    if (!parsedActivityId) {
      return sendError(res, 422, 'VALIDATION_ERROR', '`activityId` must be a positive integer.');
    }
    const activity = await prisma.activity.findUnique({ where: { id: parsedActivityId }, select: { id: true } });
    if (!activity) {
      return sendError(res, 404, 'NOT_FOUND', `Activity ${parsedActivityId} was not found.`);
    }
    data.activityId = parsedActivityId;
  }

  if (mediaDriveUrl !== undefined) {
    if (typeof mediaDriveUrl !== 'string' || !mediaDriveUrl.trim()) {
      return sendError(res, 422, 'VALIDATION_ERROR', '`mediaDriveUrl` must be a non-empty string.');
    }
    if (!parseUrl(mediaDriveUrl)) {
      return sendError(res, 422, 'VALIDATION_ERROR', '`mediaDriveUrl` must be a valid absolute URL.');
    }
    data.mediaDriveUrl = mediaDriveUrl.trim();
  }

  if (overrideName !== undefined) {
    if (overrideName !== null && typeof overrideName !== 'string') {
      return sendError(res, 422, 'VALIDATION_ERROR', '`overrideName` must be a string or null.');
    }
    data.overrideName = typeof overrideName === 'string' && overrideName.trim() ? overrideName.trim() : null;
  }

  if (overrideCover !== undefined) {
    if (overrideCover !== null && typeof overrideCover !== 'string') {
      return sendError(res, 422, 'VALIDATION_ERROR', '`overrideCover` must be a string or null.');
    }
    if (typeof overrideCover === 'string' && overrideCover.trim() && !parseUrl(overrideCover.trim())) {
      return sendError(res, 422, 'VALIDATION_ERROR', '`overrideCover` must be a valid absolute URL.');
    }
    data.overrideCover = typeof overrideCover === 'string' && overrideCover.trim() ? overrideCover.trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'No valid fields provided for media entry update.');
  }

  try {
    const updated = await prisma.mediaEntry.update({
      where: { id: entryId },
      data,
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            startTime: true,
            endTime: true,
            isPublished: true,
          },
        },
      },
    });
    return res.status(200).json({ data: serializeMediaEntry(updated) });
  } catch (error) {
    if (error?.code === 'P2025') {
      return sendError(res, 404, 'NOT_FOUND', `Media entry ${entryId} was not found.`);
    }
    logger.error({ err: error }, '[patchMediaEntry] Error updating media entry:');
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update media entry.');
  }
}

export async function deleteMediaEntry(req, res) {
  const entryId = parsePositiveInt(req.params.id);
  if (!entryId) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`id` must be a positive integer.');
  }

  try {
    await prisma.mediaEntry.delete({ where: { id: entryId } });
    return res.status(200).json({ data: { id: entryId, deleted: true } });
  } catch (error) {
    if (error?.code === 'P2025') {
      return sendError(res, 404, 'NOT_FOUND', `Media entry ${entryId} was not found.`);
    }
    logger.error({ err: error }, '[deleteMediaEntry] Error deleting media entry:');
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete media entry.');
  }
}

// Regex patterns for extracting direct image URLs from Pixieset HTML
const OG_IMAGE_RE = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
];
const PIXIESET_IMG_RE = /(?:https?:)?\/\/images\.pixieset\.com\/[^\s"']+(?:xxlarge|xlarge|large|cover)\.jpg/i;

function toAbsolute(url) {
  return url.startsWith('//') ? `https:${url}` : url;
}

export async function resolveCoverUrl(req, res) {
  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string' || !url.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`url` is required.');
  }

  const trimmed = url.trim();

  // Not a Pixieset gallery page — return as-is
  if (!trimmed.includes('pixieset.com') || !trimmed.includes('pid=')) {
    return res.json({ directUrl: trimmed });
  }

  try {
    const pageRes = await fetch(trimmed, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AussBot/1.0)' },
    });
    if (!pageRes.ok) {
      return sendError(res, 502, 'FETCH_ERROR', `Pixieset returned HTTP ${pageRes.status}.`);
    }
    const html = await pageRes.text();

    for (const re of OG_IMAGE_RE) {
      const m = html.match(re);
      if (m?.[1]) return res.json({ directUrl: toAbsolute(m[1]) });
    }

    const imgMatch = html.match(PIXIESET_IMG_RE);
    if (imgMatch) return res.json({ directUrl: toAbsolute(imgMatch[0]) });

    return sendError(res, 422, 'NOT_FOUND', 'Could not extract an image URL from this Pixieset page.');
  } catch (error) {
    logger.error({ err: error }, '[resolveCoverUrl] Fetch error:');
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch the Pixieset page.');
  }
}
