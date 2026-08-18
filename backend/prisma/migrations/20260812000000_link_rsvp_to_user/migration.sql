-- KAN-171: link event RSVPs to member accounts.
--
-- `userId` is nullable by design: legacy rows were created through the old
-- public, unauthenticated RSVP route and have no account behind them. The
-- members-only gate lands separately in KAN-178.
--
-- ON DELETE SET NULL (not CASCADE) is deliberate: deleting a user — including
-- via the KAN-134 inactive-account retention job, which hard-deletes accounts
-- past the retention window — must clear the link but preserve the RSVP row.
-- Cascading would silently erase historical attendance and event headcounts.

-- AlterTable
ALTER TABLE "Rsvp" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Rsvp_userId_createdAt_idx" ON "Rsvp"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: match existing RSVPs to accounts on normalised email. Both sides are
-- already lowercased/trimmed on write, but LOWER(TRIM(...)) is applied defensively
-- for legacy rows. Unmatched rows intentionally stay NULL — they self-heal on the
-- member's next authenticated RSVP.
UPDATE "Rsvp" r
SET "userId" = u."id"
FROM "User" u
WHERE r."userId" IS NULL
  AND LOWER(TRIM(r."email")) = LOWER(TRIM(u."email"));
