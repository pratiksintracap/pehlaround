ALTER TABLE "articles" ALTER COLUMN "author" SET DEFAULT 'Before the Bell team';--> statement-breakpoint
UPDATE "articles" SET "author" = 'Before the Bell team' WHERE "author" IN ('Off Market Desk team', 'The Off Market Desk team');--> statement-breakpoint
UPDATE "articles" SET
  "title" = replace(replace("title", 'Off Market Desk', 'Before the Bell'), 'front-row seat before the listing', 'front-row seat to India’s next listings'),
  "dek" = replace(replace("dek", 'Off Market Desk', 'Before the Bell'), 'front-row seat before the listing', 'front-row seat to India’s next listings'),
  "body" = replace(replace("body", 'Off Market Desk', 'Before the Bell'), 'front-row seat before the listing', 'front-row seat to India’s next listings')
WHERE "title" LIKE '%Off Market Desk%' OR "dek" LIKE '%Off Market Desk%' OR "body" LIKE '%Off Market Desk%' OR "body" LIKE '%front-row seat before the listing%';--> statement-breakpoint
UPDATE "settings" SET "value" = replace("value", 'Off Market Desk', 'Before the Bell') WHERE "value" LIKE '%Off Market Desk%';
