-- CreateTable
CREATE TABLE "MediaEntry" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "mediaDriveUrl" TEXT NOT NULL,
    "overrideName" TEXT,
    "overrideCover" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaEntry_activityId_idx" ON "MediaEntry"("activityId");

-- AddForeignKey
ALTER TABLE "MediaEntry" ADD CONSTRAINT "MediaEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
