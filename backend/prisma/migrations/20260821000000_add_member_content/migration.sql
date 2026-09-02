-- KAN-167: move gated dashboard perks (sponsor discount codes, exclusive content,
-- private links) out of the frontend bundle and into the database, behind an
-- explicit members-only visibility flag. The authenticated member endpoint filters
-- on `visibility = 'MEMBERS'` server-side; the browser blur/lock overlay is only
-- defence-in-depth. See KAN-112 for the approved solutioning.

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'MEMBERS');

-- CreateTable
CREATE TABLE "MemberContent" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "code" TEXT,
    "metadata" JSONB,
    "visibility" "Visibility" NOT NULL DEFAULT 'MEMBERS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberContent_visibility_isActive_idx" ON "MemberContent"("visibility", "isActive");
