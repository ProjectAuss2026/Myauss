-- KAN-186: record the privacy policy and membership declaration accepted during registration.
-- Nullable for members created before these consents were introduced.
ALTER TABLE "User"
ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyPolicyVersion" VARCHAR(20),
ADD COLUMN "membershipAgreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN "membershipAgreementVersion" VARCHAR(20);
