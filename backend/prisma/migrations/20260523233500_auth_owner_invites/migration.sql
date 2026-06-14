ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdminInvitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedRole" "Role" NOT NULL DEFAULT 'ADMIN',
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminInvitation_tokenHash_key" ON "AdminInvitation"("tokenHash");
CREATE INDEX "AdminInvitation_invitedEmail_expiresAt_idx" ON "AdminInvitation"("invitedEmail", "expiresAt");
CREATE INDEX "AdminInvitation_invitedByUserId_idx" ON "AdminInvitation"("invitedByUserId");

ALTER TABLE "AdminInvitation"
ADD CONSTRAINT "AdminInvitation_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminInvitation"
ADD CONSTRAINT "AdminInvitation_acceptedByUserId_fkey"
FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RoleChangeAudit" (
    "id" SERIAL NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "fromRole" "Role" NOT NULL,
    "toRole" "Role" NOT NULL,
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleChangeAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoleChangeAudit_targetUserId_createdAt_idx" ON "RoleChangeAudit"("targetUserId", "createdAt");
CREATE INDEX "RoleChangeAudit_actorUserId_createdAt_idx" ON "RoleChangeAudit"("actorUserId", "createdAt");

ALTER TABLE "RoleChangeAudit"
ADD CONSTRAINT "RoleChangeAudit_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoleChangeAudit"
ADD CONSTRAINT "RoleChangeAudit_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
