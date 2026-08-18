-- KAN-178: events are members-only. RSVP now requires an authenticated member
-- with an active (VERIFIED) membership, so the booking is made from the account
-- rather than typed into a public form.
--
-- studentId is dropped rather than populated from the account: UserInfo.studentId
-- stores a one-way SHA-256 hash, so it cannot be read back, and KAN-185 makes
-- student ID optional at registration for non-UoA members — a required RSVP field
-- cannot be sourced from an account that may legitimately not have one. The admin
-- CSV export drops its Student ID column accordingly (PO-accepted); name + email
-- identify the attendee and KAN-174's scanner replaces ID checks at the door.
--
-- Uniqueness moves from (activityId, email) to (activityId, userId): one place per
-- member per event. Legacy rows from the public era have a NULL userId, and
-- Postgres permits multiple NULLs in a unique index, so they coexist without
-- collision while every new authenticated booking is constrained.

-- DropIndex
DROP INDEX "Rsvp_activityId_email_key";

-- AlterTable
ALTER TABLE "Rsvp" DROP COLUMN "studentId";

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_activityId_userId_key" ON "Rsvp"("activityId", "userId");
