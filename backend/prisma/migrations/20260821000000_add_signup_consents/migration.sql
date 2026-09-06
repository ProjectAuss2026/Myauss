-- KAN-186: retain an auditable registration-time record of the two mandatory
-- signup consents. Columns are nullable so existing members are not falsely
-- represented as having accepted wording they were never shown.
ALTER TABLE "User"
ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyPolicyVersion" VARCHAR(20),
ADD COLUMN "membershipAgreementAcceptedAt" TIMESTAMP(3);
