import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { fileTypeFromBuffer } from 'file-type';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Absolute path to backend/uploads/
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_USER = 100;
const MAX_BYTES_PER_USER = 100 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
]);

const ALLOWED_STATIC_EXTENSIONS = new Set(
  [...ALLOWED_IMAGE_TYPES.values()].map((extension) => `.${extension}`)
);

// Create the folder if it doesn't exist yet
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getUploadOwnerKey(req) {
  const ownerIdentifier = req.user?.userId || req.user?.id || req.user?.email;

  if (!ownerIdentifier) {
    return null;
  }

  return crypto.createHash('sha256').update(String(ownerIdentifier)).digest('hex').slice(0, 32);
}

async function getDirectoryUsage(directory) {
  let entries;

  try {
    entries = await fsPromises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { fileCount: 0, totalBytes: 0 };
    }

    throw error;
  }

  let fileCount = 0;
  let totalBytes = 0;

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile()) {
      return;
    }

    const fileStats = await fsPromises.stat(path.join(directory, entry.name));
    fileCount += 1;
    totalBytes += fileStats.size;
  }));

  return { fileCount, totalBytes };
}

function getUploadsPublicOrigin() {
  return process.env.UPLOADS_PUBLIC_ORIGIN?.replace(/\/+$/, '');
}

function buildUploadUrl(ownerKey, fileName) {
  const uploadPath = `/uploads/${ownerKey}/${fileName}`;
  const publicOrigin = getUploadsPublicOrigin();

  return publicOrigin ? `${publicOrigin}${uploadPath}` : uploadPath;
}

export function setUploadStaticHeaders(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox");

  if (!ALLOWED_STATIC_EXTENSIONS.has(extension)) {
    res.setHeader('Content-Disposition', 'attachment');
  }
}

export { UPLOADS_DIR };

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// POST /api/upload
const uploadController = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Bad request', message: 'No file uploaded.' });
    }

    const detectedType = await fileTypeFromBuffer(req.file.buffer);

    if (!detectedType || !ALLOWED_IMAGE_TYPES.has(detectedType.mime)) {
      return res.status(415).json({
        error: 'Unsupported media type',
        message: 'Only jpg, png, gif, and webp image files are allowed.',
      });
    }

    const ownerKey = getUploadOwnerKey(req);

    if (!ownerKey) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const ownerDirectory = path.join(UPLOADS_DIR, ownerKey);
    const usage = await getDirectoryUsage(ownerDirectory);

    if (usage.fileCount >= MAX_FILES_PER_USER || usage.totalBytes + req.file.size > MAX_BYTES_PER_USER) {
      return res.status(413).json({
        error: 'Upload quota exceeded',
        message: 'You have reached the upload quota for this account.',
      });
    }

    await fsPromises.mkdir(ownerDirectory, { recursive: true });

    const extension = ALLOWED_IMAGE_TYPES.get(detectedType.mime);
    const fileName = `${crypto.randomUUID()}.${extension}`;
    const filePath = path.join(ownerDirectory, fileName);
    const imgUrl = buildUploadUrl(ownerKey, fileName);

    await fsPromises.writeFile(filePath, req.file.buffer, { flag: 'wx' });

    return res.status(201).json({
      imgUrl,
      path: `/uploads/${ownerKey}/${fileName}`,
      url: imgUrl,
      contentType: detectedType.mime,
      size: req.file.size,
    });
  } catch (error) {
    return next(error);
  }
};

export function handleUploadError(error, _req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'Uploaded files must be 5MB or smaller.',
      });
    }

    return res.status(400).json({ error: 'Bad request', message: 'Invalid upload request.' });
  }

  return next(error);
}

export default uploadController;
