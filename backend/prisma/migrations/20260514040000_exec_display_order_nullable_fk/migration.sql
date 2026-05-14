-- Add displayOrder to ExecRole and ExecTeam for drag-to-reorder priority
ALTER TABLE "ExecRole" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExecTeam" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- Make roleId and teamId nullable on Executive (allows deletion of roles/teams without blocking)
ALTER TABLE "Executive" ALTER COLUMN "roleId" DROP NOT NULL;
ALTER TABLE "Executive" ALTER COLUMN "teamId" DROP NOT NULL;
