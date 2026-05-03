import prisma from '../prismaClient.js';

const PUBLIC_CACHE_HEADER = 'public, max-age=60, stale-while-revalidate=30';

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function buildSponsorshipEtag(page) {
  const latestSponsorUpdate = page.sponsors.reduce(
    (latest, sponsor) => (sponsor.updatedAt > latest ? sponsor.updatedAt : latest),
    page.updatedAt
  );
  return `W/"sponsorship-${latestSponsorUpdate.getTime()}-${page.sponsors.length}"`;
}

function sponsorshipResponse(page) {
  return {
    id: page.id,
    pageContent: page.pageContent,
    updatedAt: page.updatedAt,
    sponsors: page.sponsors.map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      logoUrl: sponsor.logoUrl,
      websiteUrl: sponsor.websiteUrl,
      displayOrder: sponsor.displayOrder,
      sponsorshipPageId: sponsor.sponsorshipPageId,
      createdAt: sponsor.createdAt,
      updatedAt: sponsor.updatedAt,
    })),
  };
}

function parsePositiveInt(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return null;
  return number;
}

function parseNonNegativeInt(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return null;
  return number;
}

export async function getSponsorship(req, res) {
  try {
    const page = await prisma.sponsorshipPage.findFirst({
      include: {
        sponsors: {
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!page) {
      return sendError(res, 404, 'NOT_FOUND', 'Sponsorship page is not configured.');
    }

    const etag = buildSponsorshipEtag(page);
    res.set('Cache-Control', PUBLIC_CACHE_HEADER);
    res.set('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    return res.status(200).json({ data: sponsorshipResponse(page) });
  } catch (error) {
    console.error('[getSponsorship] Error fetching sponsorship data:', error);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch sponsorship data.');
  }
}

export async function patchSponsorship(req, res) {
  const { pageContent } = req.body ?? {};
  if (typeof pageContent !== 'string') {
    return sendError(res, 422, 'VALIDATION_ERROR', '`pageContent` must be a string.');
  }

  try {
    const existing = await prisma.sponsorshipPage.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!existing) {
      return sendError(res, 404, 'NOT_FOUND', 'Sponsorship page is not configured.');
    }

    const updated = await prisma.sponsorshipPage.update({
      where: { id: existing.id },
      data: { pageContent },
      include: {
        sponsors: {
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });

    return res.status(200).json({ data: sponsorshipResponse(updated) });
  } catch (error) {
    console.error('[patchSponsorship] Error updating sponsorship page:', error);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update sponsorship page.');
  }
}

export async function createSponsor(req, res) {
  const { name, sponsorshipPageId, logoUrl, websiteUrl, displayOrder } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`name` is required.');
  }

  const parsedPageId = parsePositiveInt(sponsorshipPageId);
  if (!parsedPageId) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`sponsorshipPageId` must be a positive integer.');
  }

  if (logoUrl !== undefined && logoUrl !== null && typeof logoUrl !== 'string') {
    return sendError(res, 422, 'VALIDATION_ERROR', '`logoUrl` must be a string when provided.');
  }
  if (websiteUrl !== undefined && websiteUrl !== null && typeof websiteUrl !== 'string') {
    return sendError(res, 422, 'VALIDATION_ERROR', '`websiteUrl` must be a string when provided.');
  }

  let parsedDisplayOrder = 0;
  if (displayOrder !== undefined) {
    const value = parseNonNegativeInt(displayOrder);
    if (value === null) {
      return sendError(res, 422, 'VALIDATION_ERROR', '`displayOrder` must be a non-negative integer.');
    }
    parsedDisplayOrder = value;
  }

  try {
    const page = await prisma.sponsorshipPage.findUnique({
      where: { id: parsedPageId },
    });
    if (!page) {
      return sendError(res, 404, 'NOT_FOUND', `Sponsorship page ${parsedPageId} was not found.`);
    }

    const sponsor = await prisma.sponsor.create({
      data: {
        name: name.trim(),
        sponsorshipPageId: parsedPageId,
        logoUrl: logoUrl || null,
        websiteUrl: websiteUrl || null,
        displayOrder: parsedDisplayOrder,
      },
    });

    return res.status(201).json({ data: sponsor });
  } catch (error) {
    console.error('[createSponsor] Error creating sponsor:', error);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create sponsor.');
  }
}

export async function patchSponsor(req, res) {
  const sponsorId = parsePositiveInt(req.params.id);
  if (!sponsorId) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`id` must be a positive integer.');
  }

  const { name, logoUrl, websiteUrl, displayOrder } = req.body ?? {};
  const data = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return sendError(res, 422, 'VALIDATION_ERROR', '`name` must be a non-empty string.');
    }
    data.name = name.trim();
  }
  if (logoUrl !== undefined) {
    if (logoUrl !== null && typeof logoUrl !== 'string') {
      return sendError(res, 422, 'VALIDATION_ERROR', '`logoUrl` must be a string or null.');
    }
    data.logoUrl = logoUrl || null;
  }
  if (websiteUrl !== undefined) {
    if (websiteUrl !== null && typeof websiteUrl !== 'string') {
      return sendError(res, 422, 'VALIDATION_ERROR', '`websiteUrl` must be a string or null.');
    }
    data.websiteUrl = websiteUrl || null;
  }
  if (displayOrder !== undefined) {
    const parsedDisplayOrder = parseNonNegativeInt(displayOrder);
    if (parsedDisplayOrder === null) {
      return sendError(res, 422, 'VALIDATION_ERROR', '`displayOrder` must be a non-negative integer.');
    }
    data.displayOrder = parsedDisplayOrder;
  }

  if (Object.keys(data).length === 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'No valid fields provided for sponsor update.');
  }

  try {
    const updated = await prisma.sponsor.update({
      where: { id: sponsorId },
      data,
    });
    return res.status(200).json({ data: updated });
  } catch (error) {
    if (error?.code === 'P2025') {
      return sendError(res, 404, 'SPONSOR_NOT_FOUND', `Sponsor ${sponsorId} was not found.`);
    }
    console.error('[patchSponsor] Error updating sponsor:', error);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update sponsor.');
  }
}

export async function deleteSponsor(req, res) {
  const sponsorId = parsePositiveInt(req.params.id);
  if (!sponsorId) {
    return sendError(res, 422, 'VALIDATION_ERROR', '`id` must be a positive integer.');
  }

  try {
    await prisma.sponsor.delete({
      where: { id: sponsorId },
    });
    return res.status(200).json({ data: { id: sponsorId, deleted: true } });
  } catch (error) {
    if (error?.code === 'P2025') {
      return sendError(res, 404, 'SPONSOR_NOT_FOUND', `Sponsor ${sponsorId} was not found.`);
    }
    console.error('[deleteSponsor] Error deleting sponsor:', error);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete sponsor.');
  }
}
