import prisma from '../prismaClient.js';
import { unlink } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { normalizeOptionalImageUrl } from '../utils/imageUrlPolicy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// GET /api/activities/all — admin only (includes unpublished)
export const getAllActivitiesAdmin = async (_req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      orderBy: { startTime: 'asc' },
    });
    return res.json(activities);
  } catch (err) {
    console.error('getAllActivitiesAdmin error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/activities — public
export const getActivities = async (_req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { isPublished: true },
      orderBy: { startTime: 'asc' },
    });
    return res.json(activities);
  } catch (err) {
    console.error('getActivities error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/activities — admin only
export const createActivity = async (req, res) => {
  const { title, description, startTime, endTime, imageUrl, externalLink, isPublished, capacity } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }
  if (!startTime) {
    return res.status(400).json({ error: 'startTime is required' });
  }
  if (!endTime) {
    return res.status(400).json({ error: 'endTime is required' });
  }

  const parsedStart = new Date(startTime);
  const parsedEnd = new Date(endTime);
  if (isNaN(parsedStart.getTime())) {
    return res.status(400).json({ error: 'startTime is not a valid date' });
  }
  if (isNaN(parsedEnd.getTime())) {
    return res.status(400).json({ error: 'endTime is not a valid date' });
  }
  if (parsedEnd <= parsedStart) {
    return res.status(400).json({ error: 'endTime must be after startTime' });
  }

  let parsedCapacity = null;
  if (capacity !== undefined && capacity !== null && capacity !== '') {
    parsedCapacity = parseInt(capacity, 10);
    if (isNaN(parsedCapacity) || parsedCapacity < 0) {
      return res.status(400).json({ error: 'capacity must be a non-negative integer' });
    }
  }

  const normalizedImageUrl = normalizeOptionalImageUrl(imageUrl, 'imageUrl');
  if (!normalizedImageUrl.ok) {
    return res.status(400).json({ error: normalizedImageUrl.message });
  }

  try {
    const activity = await prisma.activity.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        startTime: parsedStart,
        endTime: parsedEnd,
        imageUrl: normalizedImageUrl.value ?? null,
        externalLink: externalLink || null,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
        capacity: parsedCapacity,
      },
    });
    return res.status(201).json(activity);
  } catch (err) {
    console.error('createActivity error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /api/activities/:id — admin only
export const updateActivity = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Valid id is required' });
  }

  const { title, description, startTime, endTime, imageUrl, externalLink, isPublished, capacity } = req.body;

  try {
    const existing = await prisma.activity.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const data = {};

    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ error: 'title cannot be empty' });
      data.title = String(title).trim();
    }
    if (description !== undefined) {
      if (!String(description).trim()) return res.status(400).json({ error: 'description cannot be empty' });
      data.description = String(description).trim();
    }
    if (startTime !== undefined) {
      const d = new Date(startTime);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'startTime is not a valid date' });
      data.startTime = d;
    }
    if (endTime !== undefined) {
      const d = new Date(endTime);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'endTime is not a valid date' });
      data.endTime = d;
    }

    const effectiveStart = data.startTime ?? existing.startTime;
    const effectiveEnd = data.endTime ?? existing.endTime;
    if (effectiveEnd <= effectiveStart) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    if (imageUrl !== undefined) {
      const normalizedImageUrl = normalizeOptionalImageUrl(imageUrl, 'imageUrl');
      if (!normalizedImageUrl.ok) {
        return res.status(400).json({ error: normalizedImageUrl.message });
      }
      data.imageUrl = normalizedImageUrl.value;
    }
    if (externalLink !== undefined) data.externalLink = externalLink || null;
    if (isPublished !== undefined) data.isPublished = Boolean(isPublished);
    if (capacity !== undefined) {
      if (capacity === null || capacity === '') {
        data.capacity = null;
      } else {
        const parsedCapacity = parseInt(capacity, 10);
        if (isNaN(parsedCapacity) || parsedCapacity < 0) {
          return res.status(400).json({ error: 'capacity must be a non-negative integer' });
        }
        data.capacity = parsedCapacity;
      }
    }

    // If the image changed and the old one was a local upload, delete old file
    if (imageUrl !== undefined && imageUrl !== existing.imageUrl) {
      if (existing.imageUrl && existing.imageUrl.startsWith('/uploads/')) {
        const filename = existing.imageUrl.slice('/uploads/'.length);
        const filePath = resolve(__dirname, '../../uploads', filename);
        await unlink(filePath).catch(() => {});
      }
    }

    const activity = await prisma.activity.update({ where: { id }, data });
    return res.json(activity);
  } catch (err) {
    console.error('updateActivity error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/activities/:id — admin only
export const deleteActivity = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Valid id is required' });
  }

  try {
    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await prisma.activity.delete({ where: { id } });

    // Delete the associated uploaded image if it's a local file
    if (activity.imageUrl && activity.imageUrl.startsWith('/uploads/')) {
      const filename = activity.imageUrl.slice('/uploads/'.length);
      const filePath = resolve(__dirname, '../../uploads', filename);
      await unlink(filePath).catch(() => {}); // silently ignore if already gone
    }

    return res.status(200).json({ message: 'Activity deleted' });
  } catch (err) {
    console.error('deleteActivity error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
