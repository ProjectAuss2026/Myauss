import prisma from '../prismaClient.js';
import http from 'node:http';
import https from 'node:https';
import logger from '../utils/logger.js';
import {
  isUrlValidationError,
  resolvePublicHttpUrl,
  validateMediaEntryUrlFields,
  validatePublicImageUrl,
} from '../utils/urlValidation.js';

const PUBLIC_CACHE_HEADER = 'public, max-age=60, stale-while-revalidate=30';
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const RESPONSE_TOO_LARGE_MESSAGE = 'Response body too large.';

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function parsePositiveInt(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return null;
  return number;
}

function getMaxResponseBytes(value) {
  const maxBytes = Number(value);
  return Number.isFinite(maxBytes) && maxBytes > 0 ? Math.floor(maxBytes) : DEFAULT_MAX_RESPONSE_BYTES;
}

function getContentLength(headers) {
  const value = headers?.['content-length'];
  const contentLength = Array.isArray(value) ? value[0] : value;
  if (contentLength === undefined) return null;

  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function bufferResponseWithLimit(response, req, maxBytes, resolvePromise, rejectPromise) {
  const chunks = [];
  let totalBytes = 0;
  let settled = false;

  const rejectWithError = (error) => {
    if (settled) return;
    settled = true;
    chunks.length = 0;
    rejectPromise(error);
  };

  const rejectTooLarge = () => {
    const error = new Error(RESPONSE_TOO_LARGE_MESSAGE);
    response.destroy(error);
    req.destroy(error);
    rejectWithError(error);
  };

  response.on('error', rejectWithError);

  const contentLength = getContentLength(response.headers);
  if (contentLength !== null && contentLength > maxBytes) {
    rejectTooLarge();
    return;
  }

  response.on('data', (chunk) => {
    if (settled) return;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      rejectTooLarge();
      return;
    }
    chunks.push(buffer);
  });

  response.on('end', () => {
    if (settled) return;
    settled = true;
    const body = Buffer.concat(chunks, totalBytes).toString('utf8');
    resolvePromise({
      ok: response.statusCode >= 200 && response.statusCode < 300,
      status: response.statusCode,
      text: async () => body,
    });
  });
}

export async function fetchPinnedPublicHttpUrl(url, options = {}) {
  const { parsed, resolvedAddresses } = await resolvePublicHttpUrl(url, {
    fieldName: options.fieldName || 'URL',
  });
  const pinnedAddress = resolvedAddresses[0];
  const isHttps = parsed.protocol === 'https:';
  const transport = isHttps ? https : http;
  const port = parsed.port || (isHttps ? 443 : 80);
  const maxBytes = getMaxResponseBytes(options.maxBytes);
  const headers = {
    ...options.headers,
    Host: parsed.host,
  };

  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: pinnedAddress,
        port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers,
        servername: parsed.hostname,
        timeout: 10000,
      },
      (response) => {
        bufferResponseWithLimit(
          response,
          req,
          maxBytes,
          (value) => {
            settled = true;
            resolvePromise(value);
          },
          (error) => {
            settled = true;
            rejectPromise(error);
          }
        );
      }
    );

    req.on('timeout', () => req.destroy(new Error('Request timed out.')));
    req.on('error', (error) => {
      if (settled) return;
      settled = true;
      rejectPromise(error);
    });
    req.end();
  });
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
  if (overrideName !== undefined && overrideName !== null && typeof overrideName !== 'string') {
    return sendError(res, 422, 'VALIDATION_ERROR', '`overrideName` must be a string when provided.');
  }
  if (overrideCover !== undefined && overrideCover !== null && typeof overrideCover !== 'string') {
    return sendError(res, 422, 'VALIDATION_ERROR', '`overrideCover` must be a string when provided.');
  }

  const urls = { mediaDriveUrl, overrideCover };
  try {
    await validateMediaEntryUrlFields(urls);
  } catch (error) {
    if (isUrlValidationError(error)) {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
    throw error;
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
        mediaDriveUrl: urls.mediaDriveUrl,
        overrideName: typeof overrideName === 'string' && overrideName.trim() ? overrideName.trim() : null,
        overrideCover: urls.overrideCover || null,
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
    data.mediaDriveUrl = mediaDriveUrl;
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
    data.overrideCover = overrideCover;
  }

  if (Object.keys(data).length === 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'No valid fields provided for media entry update.');
  }

  try {
    await validateMediaEntryUrlFields(data);
    if (Object.hasOwn(data, 'overrideCover')) {
      data.overrideCover = data.overrideCover || null;
    }

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
    if (isUrlValidationError(error)) {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
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

const OG_IMAGE_RE = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
];
const PIXIESET_IMG_RE = /(?:https?:)?\/\/images\.pixieset\.com\/[^\s"']+(?:xxlarge|xlarge|large|cover)\.jpg/i;

function toAbsolute(url) {
  return url.startsWith('//') ? `https:${url}` : url;
}

async function sendAllowedCoverUrl(res, directUrl) {
  try {
    const validatedUrl = await validatePublicImageUrl(directUrl, {
      fieldName: 'Cover image URL',
    });
    return res.json({ directUrl: validatedUrl });
  } catch (error) {
    if (isUrlValidationError(error)) {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
    throw error;
  }
}

export async function resolveCoverUrl(req, res) {
  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string' || !url.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`url` is required.');
  }

  const trimmed = url.trim();

  // SECURITY (CodeQL #4): match the parsed hostname, not a substring. A check
  // like `includes('pixieset.com')` is satisfied by any URL merely containing
  // that text (e.g. https://evil.com/?pid=x#pixieset.com), which would send the
  // server-side fetch below to an arbitrary host. Non-absolute URLs (e.g.
  // /uploads/...) throw here and fall through to the direct-image path.
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return sendAllowedCoverUrl(res, trimmed);
  }

  const host = parsedUrl.hostname.toLowerCase();
  const isPixiesetHost = host === 'pixieset.com' || host.endsWith('.pixieset.com');
  if (!isPixiesetHost || !parsedUrl.searchParams.has('pid')) {
    return sendAllowedCoverUrl(res, trimmed);
  }

  try {
    const pageRes = await fetchPinnedPublicHttpUrl(trimmed, {
      fieldName: 'Gallery URL',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AussBot/1.0)' },
    });
    if (!pageRes.ok) {
      return sendError(res, 502, 'FETCH_ERROR', `Pixieset returned HTTP ${pageRes.status}.`);
    }
    const html = await pageRes.text();

    for (const re of OG_IMAGE_RE) {
      const match = html.match(re);
      if (match?.[1]) {
        return sendAllowedCoverUrl(res, toAbsolute(match[1]));
      }
    }

    const imgMatch = html.match(PIXIESET_IMG_RE);
    if (imgMatch) {
      return sendAllowedCoverUrl(res, toAbsolute(imgMatch[0]));
    }

    return sendError(res, 422, 'NOT_FOUND', 'Could not extract an image URL from this Pixieset page.');
  } catch (error) {
    logger.error({ err: error }, '[resolveCoverUrl] Fetch error:');
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch the Pixieset page.');
  }
}
