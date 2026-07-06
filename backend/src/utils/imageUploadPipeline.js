import crypto from "node:crypto";
import multer from "multer";
import path from "path";
import { promises as fsPromises } from "fs";
import { fileTypeFromBuffer } from "file-type";

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
]);

export const ALLOWED_STATIC_EXTENSIONS = new Set(
  [...ALLOWED_IMAGE_TYPES.values()].map((extension) => `.${extension}`),
);

const SVG_EXTENSION_RE = /\.svgz?$/i;
const SVG_TEXT_RE =
  /<svg\b|<!doctype\s+svg\b|xmlns\s*=\s*['"]http:\/\/www\.w3\.org\/2000\/svg['"]/i;

export class UploadedImageValidationError extends Error {
  constructor(statusCode, error, message) {
    super(message);
    this.name = "UploadedImageValidationError";
    this.statusCode = statusCode;
    this.error = error;
  }
}

function readTextHead(buffer) {
  return buffer.subarray(0, 1024).toString("utf8");
}

function looksLikeSvg(file) {
  const mimeType = String(file?.mimetype || "")
    .trim()
    .toLowerCase();
  const originalName = String(file?.originalname || "").trim();

  if (mimeType === "image/svg+xml" || SVG_EXTENSION_RE.test(originalName)) {
    return true;
  }

  if (!file?.buffer?.length) {
    return false;
  }

  return SVG_TEXT_RE.test(readTextHead(file.buffer));
}

export function createImageUploadMiddleware({
  files = 1,
  fileSize = MAX_IMAGE_UPLOAD_BYTES,
} = {}) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize,
      files,
    },
  });

  const wrap =
    (methodName) =>
    (...args) => {
      const middleware = upload[methodName](...args);
      return (req, res, next) => {
        req.imageUploadMaxBytes = fileSize;
        return middleware(req, res, next);
      };
    };

  return {
    single: wrap("single"),
    array: wrap("array"),
    fields: wrap("fields"),
    none: wrap("none"),
    any: wrap("any"),
  };
}

function formatUploadSizeLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "5 MB";
  }

  const megabytes = bytes / (1024 * 1024);
  if (Number.isInteger(megabytes)) {
    return `${megabytes} MB`;
  }

  return `${megabytes.toFixed(1)} MB`;
}

export async function validateUploadedImage(file) {
  if (!file?.buffer) {
    throw new UploadedImageValidationError(
      400,
      "Bad request",
      "No file uploaded.",
    );
  }

  if (looksLikeSvg(file)) {
    throw new UploadedImageValidationError(
      415,
      "Unsupported media type",
      "SVG files are not allowed.",
    );
  }

  const detectedType = await fileTypeFromBuffer(file.buffer);

  if (!detectedType || !ALLOWED_IMAGE_TYPES.has(detectedType.mime)) {
    throw new UploadedImageValidationError(
      415,
      "Unsupported media type",
      "Only jpg, png, gif, and webp image files are allowed.",
    );
  }

  return {
    mimeType: detectedType.mime,
    extension: ALLOWED_IMAGE_TYPES.get(detectedType.mime),
    sizeBytes: file.size ?? file.buffer.length,
  };
}

export async function writeBufferToUniqueFile({
  directory,
  buffer,
  extension,
}) {
  await fsPromises.mkdir(directory, { recursive: true });

  const fileName = `${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(directory, fileName);

  await fsPromises.writeFile(filePath, buffer, { flag: "wx" });

  return { fileName, filePath };
}

export async function deleteFileIfExists(filePath) {
  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

export function handleImageUploadError(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      const maxBytes = req?.imageUploadMaxBytes || MAX_IMAGE_UPLOAD_BYTES;
      return res.status(413).json({
        error: "File too large",
        message: `Uploaded files must be ${formatUploadSizeLabel(maxBytes)} or smaller.`,
      });
    }

    return res
      .status(400)
      .json({ error: "Bad request", message: "Invalid upload request." });
  }

  if (error instanceof UploadedImageValidationError) {
    return res.status(error.statusCode).json({
      error: error.error,
      message: error.message,
    });
  }

  return next(error);
}
