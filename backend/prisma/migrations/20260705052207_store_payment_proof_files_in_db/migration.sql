-- AlterTable
ALTER TABLE "PaymentProofUpload"
ADD COLUMN     "fileBytes" BYTEA,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Legacy filesystem-backed rows cannot be backfilled inside SQL because the
-- old file contents lived outside Postgres. Preserve the row shape and let the
-- application treat empty bytes as a missing legacy file.
UPDATE "PaymentProofUpload"
SET
  "fileBytes" = ''::bytea,
  "updatedAt" = COALESCE("linkedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "fileBytes" IS NULL;

ALTER TABLE "PaymentProofUpload"
ALTER COLUMN "fileBytes" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
DROP COLUMN     "storagePath";
