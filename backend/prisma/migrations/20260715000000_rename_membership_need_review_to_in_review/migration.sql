-- Rename MembershipStatus enum value NEED_REVIEW -> IN_REVIEW.
-- KAN-152 (#24) renamed this in schema.prisma/code but shipped no migration,
-- leaving the DB enum drifted. RENAME VALUE preserves existing rows (unlike a
-- drop/add), so no data migration is needed.
ALTER TYPE "MembershipStatus" RENAME VALUE 'NEED_REVIEW' TO 'IN_REVIEW';
