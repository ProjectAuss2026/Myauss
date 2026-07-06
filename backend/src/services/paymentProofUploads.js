import path from "node:path";
import prisma from "../prismaClient.js";
import logger from "../utils/logger.js";
import { validateUploadedImage } from "../utils/imageUploadPipeline.js";

const DEFAULT_PENDING_PAYMENT_PROOF_RETENTION_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

export const PAYMENT_PROOF_UPLOAD_STATUS = Object.freeze({
  PENDING: "PENDING",
  LINKED: "LINKED",
});

export const PAYMENT_PROOF_UPLOAD_METADATA_SELECT = Object.freeze({
  id: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  linkedAt: true,
  createdAt: true,
  updatedAt: true,
  expiresAt: true,
});

export const PAYMENT_PROOF_UPLOAD_VALIDATION_SELECT = Object.freeze({
  id: true,
  userId: true,
  status: true,
  linkedAt: true,
  expiresAt: true,
});

export const PAYMENT_PROOF_UPLOAD_FILE_SELECT = Object.freeze({
  id: true,
  userId: true,
  originalFilename: true,
  mimeType: true,
  fileBytes: true,
});

function sanitizeOriginalFilename(originalFilename, fallbackName) {
  const normalized = path.basename(String(originalFilename || "").trim());
  return (normalized || fallbackName).slice(0, 255);
}

export function getPendingPaymentProofRetentionHours() {
  const parsed = Number(process.env.PAYMENT_PROOF_UPLOAD_RETENTION_HOURS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PENDING_PAYMENT_PROOF_RETENTION_HOURS;
  }
  return Math.floor(parsed);
}

export function buildPendingPaymentProofExpiry(now = new Date()) {
  return new Date(
    now.getTime() + getPendingPaymentProofRetentionHours() * MS_PER_HOUR,
  );
}

export function formatPaymentProofUpload(upload) {
  return {
    id: upload.id,
    originalFilename: upload.originalFilename,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    expiresAt: upload.expiresAt,
    createdAt: upload.createdAt,
    updatedAt: upload.updatedAt,
    linkedAt: upload.linkedAt,
    status: upload.status,
  };
}

export async function createPendingPaymentProofUpload({
  file,
  client = prisma,
  now = new Date(),
}) {
  const uploadedImage = await validateUploadedImage(file);
  const expiresAt = buildPendingPaymentProofExpiry(now);

  return client.paymentProofUpload.create({
    data: {
      originalFilename: sanitizeOriginalFilename(
        file.originalname,
        `payment-proof.${uploadedImage.extension}`,
      ),
      fileBytes: Buffer.from(file.buffer),
      mimeType: uploadedImage.mimeType,
      sizeBytes: uploadedImage.sizeBytes,
      status: PAYMENT_PROOF_UPLOAD_STATUS.PENDING,
      expiresAt,
    },
    select: PAYMENT_PROOF_UPLOAD_METADATA_SELECT,
  });
}

export async function deletePendingPaymentProofUpload({
  proofUploadId,
  client = prisma,
}) {
  const upload = await client.paymentProofUpload.findUnique({
    where: { id: proofUploadId },
    select: {
      id: true,
      userId: true,
      linkedAt: true,
      status: true,
    },
  });

  if (!upload) {
    return { status: "not_found" };
  }

  if (
    upload.userId ||
    upload.linkedAt ||
    upload.status !== PAYMENT_PROOF_UPLOAD_STATUS.PENDING
  ) {
    return { status: "linked", upload };
  }

  await client.paymentProofUpload.delete({ where: { id: proofUploadId } });

  return { status: "deleted", upload };
}

export async function cleanupExpiredPendingPaymentProofUploads(
  now = new Date(),
  client = prisma,
) {
  const uploads = await client.paymentProofUpload.findMany({
    where: {
      status: PAYMENT_PROOF_UPLOAD_STATUS.PENDING,
      userId: null,
      linkedAt: null,
      expiresAt: { lt: now },
    },
    select: { id: true },
  });

  if (uploads.length === 0) {
    return 0;
  }

  const result = await client.paymentProofUpload.deleteMany({
    where: {
      id: { in: uploads.map((upload) => upload.id) },
    },
  });

  if (result.count > 0) {
    logger.info(
      { count: result.count, cutoff: now },
      "Cleaned up expired staged payment proof uploads",
    );
  }

  return result.count;
}
