-- Whey Protein Powder: 25 g protein per 30 g scoop (83.3 g per 100 g).
-- Fixes the shared food, and saved-meal ingredients that still carry its old value. Logged food is history and stays as logged.
UPDATE "foods" SET "p" = 83.3 WHERE "owner_id" IS NULL AND lower("name") = 'whey protein powder';
--> statement-breakpoint
UPDATE "meals" m SET "items" = (
  SELECT jsonb_agg(CASE WHEN lower(i->>'name') = 'whey protein powder' AND (i->>'p')::numeric = 74 THEN jsonb_set(i, '{p}', '83.3'::jsonb) ELSE i END ORDER BY ord)
  FROM jsonb_array_elements(m."items") WITH ORDINALITY AS t(i, ord)
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(m."items") i WHERE lower(i->>'name') = 'whey protein powder' AND (i->>'p')::numeric = 74
);
