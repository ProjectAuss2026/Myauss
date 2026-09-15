-- Membership fee wording in the FAQ (committee decision 2026-09-11).
--
-- Pricing is unchanged: the NZ$10 / NZ$20 base stands and the 50% launch promo
-- runs to the end of Semester 2 (16 Nov 2026), so members pay NZ$5 (membership)
-- or NZ$15 (membership + shirt; the shirt add-on is never discounted) until
-- then, then revert to NZ$10 / NZ$20.
--
-- The FAQ still advertised $10 / $20, which already contradicted the live
-- charge. It now matches the pricing page.
--
-- Idempotent: updates the existing row in place. If a database has no FAQ row
-- yet (fresh dev DB before the seed), the UPDATE matches nothing and the seed
-- creates all FAQ entries with the new wording. The seed only runs when the
-- table is empty, so an INSERT here would suppress the other five entries.
--
-- The Railway deploy pipeline runs `prisma migrate deploy`, NOT the seed, so
-- this row change must ship as a migration.

UPDATE "Faq"
   SET "answer" = 'AUSS membership is 50% off until the end of Semester 2: $5, or $15 including an official AUSS shirt (normally $10 / $20). This is separate from gym membership.',
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE "question" = 'Is there a membership fee?';
