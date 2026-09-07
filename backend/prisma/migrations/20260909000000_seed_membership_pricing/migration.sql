-- Seed the single MembershipPricing row (id=1) with launch config: 50% promo,
-- shirt tier ON, promo ends end of Semester 2 (16 Nov 2026).
-- The Railway deploy pipeline runs `prisma migrate deploy` but NOT the seed
-- script, so required config rows ship as migrations. ON CONFLICT DO NOTHING
-- keeps future admin edits (e.g. ending the promo) intact on re-deploys.
INSERT INTO "MembershipPricing"
  ("id", "membershipCents", "shirtAddonCents", "shirtTierEnabled", "promoActive", "promoPercentOff", "promoEndsAt", "updatedAt")
VALUES
  (1, 1000, 1000, true, true, 50, '2026-11-16 23:59:59.000', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
