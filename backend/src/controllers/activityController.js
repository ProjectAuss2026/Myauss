import prisma from '../prismaClient.js';
import { unlink } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../utils/logger.js';
import { isUrlValidationError, validateActivityUrlFields } from '../utils/urlValidation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = resolve(__dirname, '../../uploads');

function parsePositiveInt(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return null;
  return number;
}

function parseActivityDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseActivityCapacity(value) {
  if (value === undefined) return { provided: false, value: undefined };
  if (value === null || value === '') return { provided: true, value: null };

  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return null;
  return { provided: true, value: number };
}

function parsePublishedFlag(value) {
  if (value === undefined) return { provided: false, value: undefined };
  if (typeof value === 'boolean') return { provided: true, value };
  if (value === 'true') return { provided: true, value: true };
  if (value === 'false') return { provided: true, value: false };
  return null;
}

async function deleteUploadedActivityImage(imageUrl) {
  if (!imageUrl?.startsWith('/uploads/')) return;

  const relativePath = imageUrl.slice('/uploads/'.length);
  const filePath = resolve(UPLOADS_DIR, relativePath);
  if (!filePath.startsWith(`${UPLOADS_DIR}${sep}`)) return;

  await unlink(filePath).catch(() => {});
}

export const getAllActivitiesAdmin = async (_req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      orderBy: { startTime: 'asc' },
    });
    return res.json(activities);
  } catch (err) {
    logger.error({ err }, 'getAllActivitiesAdmin error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getActivities = async (_req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { isPublished: true },
      orderBy: { startTime: 'asc' },
    });
    return res.json(activities);
  } catch (err) {
    logger.error({ err }, 'getActivities error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createActivity = async (req, res) => {
  const { title, description, startTime, endTime, imageUrl, externalLink, isPublished, capacity } = req.body ?? {};

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }

  const parsedStart = parseActivityDate(startTime);
  if (!parsedStart) {
    return res.status(400).json({ error: 'startTime is not a valid date' });
  }
  const parsedEnd = parseActivityDate(endTime);
  if (!parsedEnd) {
    return res.status(400).json({ error: 'endTime is not a valid date' });
  }
  if (parsedEnd <= parsedStart) {
    return res.status(400).json({ error: 'endTime must be after startTime' });
  }

  const parsedPublished = parsePublishedFlag(isPublished);
  if (parsedPublished === null) {
    return res.status(400).json({ error: 'isPublished must be a boolean' });
  }

  const parsedCapacity = parseActivityCapacity(capacity);
  if (parsedCapacity === null) {
    return res.status(400).json({ error: 'capacity must be a non-negative integer' });
  }

  const data = {
    title: title.trim(),
    description: description.trim(),
    startTime: parsedStart,
    endTime: parsedEnd,
    imageUrl,
    externalLink,
    isPublished: parsedPublished.provided ? parsedPublished.value : true,
    capacity: parsedCapacity.provided ? parsedCapacity.value : null,
  };

  try {
    await validateActivityUrlFields(data);

    const activity = await prisma.activity.create({
      data: {
        ...data,
        imageUrl: data.imageUrl || null,
        externalLink: data.externalLink || null,
      },
    });
    return res.status(201).json(activity);
  } catch (err) {
    if (isUrlValidationError(err)) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err }, 'createActivity error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateActivity = async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Activity id must be a positive integer' });
  }

  const { title, description, startTime, endTime, imageUrl, externalLink, isPublished, capacity } = req.body ?? {};

  try {
    const existing = await prisma.activity.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const data = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }
      data.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'description must be a non-empty string' });
      }
      data.description = description.trim();
    }

    if (startTime !== undefined) {
      const parsedStart = parseActivityDate(startTime);
      if (!parsedStart) {
        return res.status(400).json({ error: 'startTime is not a valid date' });
      }
      data.startTime = parsedStart;
    }

    if (endTime !== undefined) {
      const parsedEnd = parseActivityDate(endTime);
      if (!parsedEnd) {
        return res.status(400).json({ error: 'endTime is not a valid date' });
      }
      data.endTime = parsedEnd;
    }

    const effectiveStart = data.startTime ?? existing.startTime;
    const effectiveEnd = data.endTime ?? existing.endTime;
    if (effectiveEnd <= effectiveStart) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    if (imageUrl !== undefined) {
      data.imageUrl = imageUrl;
    }
    if (externalLink !== undefined) {
      data.externalLink = externalLink;
    }

    if (isPublished !== undefined) {
      const parsedPublished = parsePublishedFlag(isPublished);
      if (parsedPublished === null) {
        return res.status(400).json({ error: 'isPublished must be a boolean' });
      }
      data.isPublished = parsedPublished.value;
    }

    if (capacity !== undefined) {
      const parsedCapacity = parseActivityCapacity(capacity);
      if (parsedCapacity === null) {
        return res.status(400).json({ error: 'capacity must be a non-negative integer' });
      }
      data.capacity = parsedCapacity.value;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'At least one activity field must be provided' });
    }

    await validateActivityUrlFields(data);
    if (Object.hasOwn(data, 'imageUrl')) {
      data.imageUrl = data.imageUrl || null;
    }
    if (Object.hasOwn(data, 'externalLink')) {
      data.externalLink = data.externalLink || null;
    }

    if (Object.hasOwn(data, 'imageUrl') && data.imageUrl !== existing.imageUrl) {
      await deleteUploadedActivityImage(existing.imageUrl);
    }

    const activity = await prisma.activity.update({ where: { id }, data });
    return res.json(activity);
  } catch (err) {
    if (isUrlValidationError(err)) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err }, 'updateActivity error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteActivity = async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Activity id must be a positive integer' });
  }

  try {
    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await prisma.activity.delete({ where: { id } });
    await deleteUploadedActivityImage(activity.imageUrl);

    return res.status(200).json({ message: 'Activity deleted' });
  } catch (err) {
    logger.error({ err }, 'deleteActivity error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};
