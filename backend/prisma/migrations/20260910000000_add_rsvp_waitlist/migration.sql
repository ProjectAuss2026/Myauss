-- KAN-189 (waitlist) + KAN-190 (execs don't consume capacity).
--
-- status defaults to CONFIRMED, so every existing row is migrated to CONFIRMED
-- with no backfill statement needed.
--
-- countsTowardCapacity defaults to true, which deliberately leaves EXISTING
-- rows — including any made by ADMIN/OWNER accounts — counting toward capacity.
-- The value is a snapshot of the decision in force when the RSVP was made, and
-- retroactively flipping historical exec rows to false would rewrite the
-- headcount of events that have already run. That is precisely the failure
-- snapshotting exists to prevent, so old rows keep the old answer and only new
-- RSVPs get the new policy.

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('CONFIRMED', 'WAITLISTED');

-- AlterTable
ALTER TABLE "Rsvp" ADD COLUMN     "countsTowardCapacity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "RsvpStatus" NOT NULL DEFAULT 'CONFIRMED';

-- CreateIndex
CREATE INDEX "Rsvp_activityId_status_countsTowardCapacity_idx" ON "Rsvp"("activityId", "status", "countsTowardCapacity");

-- CreateIndex
CREATE INDEX "Rsvp_activityId_status_createdAt_idx" ON "Rsvp"("activityId", "status", "createdAt");
