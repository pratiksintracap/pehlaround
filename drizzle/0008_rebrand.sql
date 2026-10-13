ALTER TABLE "articles" ALTER COLUMN "author" SET DEFAULT 'Off Market Desk team';--> statement-breakpoint
UPDATE "articles" SET "author" = 'Off Market Desk team' WHERE "author" IN ('Pehla Round desk', 'The Pehla Round desk');--> statement-breakpoint
UPDATE "articles" SET
  "title" = replace(replace(replace("title", 'Pehla Round', 'Off Market Desk'), 'Pehla Score', 'Desk Score'), 'pehlaround.in', 'offmarketdesk.in'),
  "dek" = replace(replace(replace("dek", 'Pehla Round', 'Off Market Desk'), 'Pehla Score', 'Desk Score'), 'pehlaround.in', 'offmarketdesk.in'),
  "body" = replace(replace(replace("body", 'Pehla Round', 'Off Market Desk'), 'Pehla Score', 'Desk Score'), 'pehlaround.in', 'offmarketdesk.in')
WHERE "title" LIKE '%Pehla%' OR "dek" LIKE '%Pehla%' OR "body" LIKE '%Pehla%' OR "body" LIKE '%pehlaround%';--> statement-breakpoint
UPDATE "settings" SET "value" = replace(replace("value", 'Pehla Round', 'Off Market Desk'), 'pehlaround.in', 'offmarketdesk.in') WHERE "value" LIKE '%Pehla%' OR "value" LIKE '%pehlaround%';
