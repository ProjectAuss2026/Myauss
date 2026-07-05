-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INACTIVE', 'NEED_REVIEW', 'VERIFIED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'INACTIVE',
ADD COLUMN     "membershipStatusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "MembershipStatusAudit" (
    "id" SERIAL NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT NOT NULL,
    "fromStatus" "MembershipStatus" NOT NULL,
    "toStatus" "MembershipStatus" NOT NULL,
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipStatusAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipStatusAudit_targetUserId_createdAt_idx" ON "MembershipStatusAudit"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MembershipStatusAudit_actorUserId_createdAt_idx" ON "MembershipStatusAudit"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "User_membershipStatus_membershipStatusUpdatedAt_idx" ON "User"("membershipStatus", "membershipStatusUpdatedAt");

-- AddForeignKey
ALTER TABLE "MembershipStatusAudit" ADD CONSTRAINT "MembershipStatusAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipStatusAudit" ADD CONSTRAINT "MembershipStatusAudit_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

