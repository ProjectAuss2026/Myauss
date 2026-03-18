import prisma from '../prismaClient.js';
import { unlink } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  const { title, description, startTime, endTime, imageUrl, externalLink, isPublished } = req.body;

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

  try {
    const activity = await prisma.activity.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        startTime: parsedStart,
        endTime: parsedEnd,
        imageUrl: imageUrl || null,
        externalLink: externalLink || null,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      },
    });
    return res.status(201).json(activity);
  } catch (err) {
    console.error('createActivity error:', err);
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
