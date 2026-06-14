CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptsRemaining" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OtpCode_userId_key" ON "OtpCode"("userId");
CREATE INDEX "OtpCode_expiresAt_consumedAt_idx" ON "OtpCode"("expiresAt", "consumedAt");

ALTER TABLE "OtpCode"
ADD CONSTRAINT "OtpCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
