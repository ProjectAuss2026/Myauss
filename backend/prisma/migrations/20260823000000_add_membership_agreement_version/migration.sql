-- Retain the membership agreement wording version accepted at registration.
-- The column is nullable so existing members are not falsely represented as
-- having accepted wording they were never shown.
ALTER TABLE "User"
ADD COLUMN "membershipAgreementVersion" VARCHAR(20);
