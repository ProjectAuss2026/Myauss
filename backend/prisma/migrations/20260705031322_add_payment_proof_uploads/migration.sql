-- CreateEnum
CREATE TYPE "PaymentProofUploadStatus" AS ENUM ('PENDING', 'LINKED');

-- CreateTable
CREATE TABLE "PaymentProofUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "PaymentProofUploadStatus" NOT NULL DEFAULT 'PENDING',
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProofUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProofUpload_userId_createdAt_idx" ON "PaymentProofUpload"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentProofUpload_status_expiresAt_idx" ON "PaymentProofUpload"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "PaymentProofUpload" ADD CONSTRAINT "PaymentProofUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
