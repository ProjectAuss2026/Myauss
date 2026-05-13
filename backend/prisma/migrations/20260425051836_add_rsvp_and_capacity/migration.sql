-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "capacity" INTEGER;

-- CreateTable
CREATE TABLE "Rsvp" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rsvp_activityId_idx" ON "Rsvp"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_activityId_email_key" ON "Rsvp"("activityId", "email");

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
