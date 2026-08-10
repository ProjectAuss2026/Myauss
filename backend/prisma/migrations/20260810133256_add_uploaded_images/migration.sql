-- CreateTable
CREATE TABLE "UploadedImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "originalFilename" TEXT,
    "fileBytes" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UploadedImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedImage_userId_createdAt_idx" ON "UploadedImage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UploadedImage" ADD CONSTRAINT "UploadedImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
