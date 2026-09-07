-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "includesShirt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shirtSize" VARCHAR(8);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "shirtSize" VARCHAR(8);

-- CreateTable
CREATE TABLE "MembershipPricing" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "membershipCents" INTEGER NOT NULL DEFAULT 1000,
    "shirtAddonCents" INTEGER NOT NULL DEFAULT 1000,
    "promoActive" BOOLEAN NOT NULL DEFAULT true,
    "promoPercentOff" INTEGER NOT NULL DEFAULT 50,
    "promoEndsAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipPricing_pkey" PRIMARY KEY ("id")
);
