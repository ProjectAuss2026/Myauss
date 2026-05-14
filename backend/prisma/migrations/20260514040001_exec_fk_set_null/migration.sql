-- Change FK constraints on Executive to ON DELETE SET NULL
-- so that deleting a role or team automatically nulls the FK on Executive rows.

ALTER TABLE "Executive" DROP CONSTRAINT IF EXISTS "Executive_roleId_fkey";
ALTER TABLE "Executive" ADD CONSTRAINT "Executive_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "ExecRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Executive" DROP CONSTRAINT IF EXISTS "Executive_teamId_fkey";
ALTER TABLE "Executive" ADD CONSTRAINT "Executive_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "ExecTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
