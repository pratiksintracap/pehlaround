UPDATE "articles" SET "body" = replace("body", 'offmarketdesk.in', 'beforethebell.in') WHERE "body" LIKE '%offmarketdesk.in%';--> statement-breakpoint
UPDATE "settings" SET "value" = replace("value", 'offmarketdesk.in', 'beforethebell.in') WHERE "value" LIKE '%offmarketdesk.in%';
