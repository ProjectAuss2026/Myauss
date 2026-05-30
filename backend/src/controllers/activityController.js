import prisma from '../prismaClient.js';
import { unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function deleteUploadedActivityImage(imageUrl) {
  if (!imageUrl?.startsWith('/uploads/')) return;
  const filename = imageUrl.slice('/uploads/'.length);
  const filePath = resolve(__dirname, '../../uploads', filename);
  await unlink(filePath).catch(() => {});
}

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

  try {
    const activity = await prisma.activity.create({
      data: {
        title,
        description,
        startTime,
        endTime,
        imageUrl: imageUrl || null,
        externalLink: externalLink || null,
        isPublished: isPublished ?? true,
        capacity: capacity ?? null,
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
  const id = req.params.id;

  const { title, description, startTime, endTime, imageUrl, externalLink, isPublished, capacity } = req.body;

  try {
    const existing = await prisma.activity.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const data = {};

    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;

    const effectiveStart = data.startTime ?? existing.startTime;
    const effectiveEnd = data.endTime ?? existing.endTime;
    if (effectiveEnd <= effectiveStart) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (externalLink !== undefined) data.externalLink = externalLink || null;
    if (isPublished !== undefined) data.isPublished = isPublished;
    if (capacity !== undefined) data.capacity = capacity;

    // If the image changed and the old one was a local upload, delete old file
    if (imageUrl !== undefined && imageUrl !== existing.imageUrl) {
      await deleteUploadedActivityImage(existing.imageUrl);
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
  const id = req.params.id;

  try {
    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await prisma.activity.delete({ where: { id } });

    // Delete the associated uploaded image if it's a local file
    await deleteUploadedActivityImage(activity.imageUrl);

    return res.status(200).json({ message: 'Activity deleted' });
  } catch (err) {
    console.error('deleteActivity error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
