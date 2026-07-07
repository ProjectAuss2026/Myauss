import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import {
  ALLOWED_STATIC_EXTENSIONS,
  createImageUploadMiddleware,
  handleImageUploadError,
  validateUploadedImage,
  writeBufferToUniqueFile,
} from "../utils/imageUploadPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Absolute path to backend/uploads/
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const MAX_FILES_PER_USER = 100;
const MAX_BYTES_PER_USER = 100 * 1024 * 1024;

// Create the folder if it doesn't exist yet
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getUploadOwnerKey(req) {
  const ownerIdentifier = req.user?.userId || req.user?.id || req.user?.email;

  if (!ownerIdentifier) {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(String(ownerIdentifier))
    .digest("hex")
    .slice(0, 32);
}

async function getDirectoryUsage(directory) {
  let entries;

  try {
    entries = await fsPromises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return { fileCount: 0, totalBytes: 0 };
    }

    throw error;
  }

  let fileCount = 0;
  let totalBytes = 0;

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      const fileStats = await fsPromises.stat(path.join(directory, entry.name));
      fileCount += 1;
      totalBytes += fileStats.size;
    }),
  );

  return { fileCount, totalBytes };
}

function getUploadsPublicOrigin() {
  return process.env.UPLOADS_PUBLIC_ORIGIN?.replace(/\/+$/, "");
}

function buildUploadUrl(ownerKey, fileName) {
  const uploadPath = `/uploads/${ownerKey}/${fileName}`;
  const publicOrigin = getUploadsPublicOrigin();

  return publicOrigin ? `${publicOrigin}${uploadPath}` : uploadPath;
}

export function setUploadStaticHeaders(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox",
  );

  if (!ALLOWED_STATIC_EXTENSIONS.has(extension)) {
    res.setHeader("Content-Disposition", "attachment");
  }
}

export { UPLOADS_DIR };

export const upload = createImageUploadMiddleware();

// POST /api/upload
const uploadController = async (req, res, next) => {
  try {
    const uploadedImage = await validateUploadedImage(req.file);

    const ownerKey = getUploadOwnerKey(req);

    if (!ownerKey) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const ownerDirectory = path.join(UPLOADS_DIR, ownerKey);
    const usage = await getDirectoryUsage(ownerDirectory);

    if (
      usage.fileCount >= MAX_FILES_PER_USER ||
      usage.totalBytes + req.file.size > MAX_BYTES_PER_USER
    ) {
      return res.status(413).json({
        error: "Upload quota exceeded",
        message: "You have reached the upload quota for this account.",
      });
    }

    await fsPromises.mkdir(ownerDirectory, { recursive: true });

    const { fileName } = await writeBufferToUniqueFile({
      directory: ownerDirectory,
      buffer: req.file.buffer,
      extension: uploadedImage.extension,
    });
    const imgUrl = buildUploadUrl(ownerKey, fileName);

    return res.status(201).json({
      imgUrl,
      path: `/uploads/${ownerKey}/${fileName}`,
      url: imgUrl,
      contentType: uploadedImage.mimeType,
      size: uploadedImage.sizeBytes,
    });
  } catch (error) {
    return next(error);
  }
};

export function handleUploadError(error, _req, res, next) {
  return handleImageUploadError(error, _req, res, next);
}

export default uploadController;
