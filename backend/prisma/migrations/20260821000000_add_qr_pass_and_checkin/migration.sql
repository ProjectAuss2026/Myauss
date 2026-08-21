-- KAN-180: event QR check-in.
--
-- qrVersion is NOT a secret. The member's pass is
-- HMAC(User.id + ":" + qrVersion, QR_PASS_SECRET), so bumping this integer
-- revokes that member's QR instantly — without touching User.id (19 tables
-- foreign-key to it) and without affecting any other member. Defaulting to 1
-- means every existing member's pass is valid on deploy with no backfill.
--
-- checkedInBy uses ON DELETE SET NULL for the same reason as Rsvp.userId:
-- deleting the exec who scanned — including via the KAN-134 retention job —
-- must clear the attribution but preserve the attendance record.

-- AlterTable
ALTER TABLE "Rsvp" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInByUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "qrVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Rsvp_activityId_checkedInAt_idx" ON "Rsvp"("activityId", "checkedInAt");

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
