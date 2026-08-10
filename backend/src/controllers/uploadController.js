import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import prisma from "../prismaClient.js";
import {
  ALLOWED_STATIC_EXTENSIONS,
  createImageUploadMiddleware,
  handleImageUploadError,
  validateUploadedImage,
} from "../utils/imageUploadPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Absolute path to backend/uploads/ — KEPT for backward compatibility with
// existing disk files (express.static in app.js still serves old images).
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const MAX_FILES_PER_USER = 100;
const MAX_BYTES_PER_USER = 100 * 1024 * 1024;

// Create the folder if it doesn't exist yet (for local dev / legacy files)
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
// Stores the uploaded image in the UploadedImage table (Postgres) so it
// survives ephemeral-filesystem redeploys on Railway, unlike the previous
// disk-based storage. The response URL points to GET /api/upload/:id which
// serves the raw bytes directly from the database.
const uploadController = async (req, res, next) => {
  try {
    const uploadedImage = await validateUploadedImage(req.file);

    const userId = req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Quota check: aggregate across the user's existing uploaded images in DB
    const usage = await prisma.uploadedImage.aggregate({
      where: { userId },
      _count: true,
      _sum: { sizeBytes: true },
    });

    if (
      usage._count >= MAX_FILES_PER_USER ||
      (usage._sum.sizeBytes ?? 0) + req.file.size > MAX_BYTES_PER_USER
    ) {
      return res.status(413).json({
        error: "Upload quota exceeded",
        message: "You have reached the upload quota for this account.",
      });
    }

    // Store the raw bytes in the database (like PaymentProofUpload)
    const image = await prisma.uploadedImage.create({
      data: {
        userId,
        originalFilename: req.file?.originalname ?? null,
        fileBytes: req.file.buffer,
        mimeType: uploadedImage.mimeType,
        sizeBytes: uploadedImage.sizeBytes,
      },
    });

    const imgUrl = `/api/upload/${image.id}`;

    return res.status(201).json({
      imgUrl,
      path: imgUrl,
      url: imgUrl,
      contentType: uploadedImage.mimeType,
      size: uploadedImage.sizeBytes,
      id: image.id,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/upload/:id
// Serves the raw image bytes from the UploadedImage table.  No authentication
// required — images are embedded in public and admin pages via <img> tags.
// The id is a UUID so it cannot be guessed; caching is aggressive (immutable)
// because the bytes never change and deleting the record invalidates the URL.
export async function serveUploadedImage(req, res) {
  try {
    const image = await prisma.uploadedImage.findUnique({
      where: { id: req.params.id },
    });
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    return res.send(image.fileBytes);
  } catch (_err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export function handleUploadError(error, _req, res, next) {
  return handleImageUploadError(error, _req, res, next);
}

export default uploadController;
