/*
  Warnings:

  - The values [NEED_REVIEW] on the enum `MembershipStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MembershipStatus_new" AS ENUM ('INACTIVE', 'IN_REVIEW', 'VERIFIED');
ALTER TABLE "public"."User" ALTER COLUMN "membershipStatus" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "membershipStatus" TYPE "MembershipStatus_new" USING ("membershipStatus"::text::"MembershipStatus_new");
ALTER TABLE "MembershipStatusAudit" ALTER COLUMN "fromStatus" TYPE "MembershipStatus_new" USING ("fromStatus"::text::"MembershipStatus_new");
ALTER TABLE "MembershipStatusAudit" ALTER COLUMN "toStatus" TYPE "MembershipStatus_new" USING ("toStatus"::text::"MembershipStatus_new");
ALTER TYPE "MembershipStatus" RENAME TO "MembershipStatus_old";
ALTER TYPE "MembershipStatus_new" RENAME TO "MembershipStatus";
DROP TYPE "public"."MembershipStatus_old";
ALTER TABLE "User" ALTER COLUMN "membershipStatus" SET DEFAULT 'INACTIVE';
COMMIT;
