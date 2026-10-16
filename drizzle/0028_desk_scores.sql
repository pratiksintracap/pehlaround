-- Desk Scores raised (16 Oct 2026): every company on the desk at 8.0 or above, top at 8.8, order unchanged.
-- Only raises a score that is still below its new value, so a higher score the desk set in admin is kept.
UPDATE "deals" SET "score" = 8.8 WHERE "slug" = 'naval-defence-secondary' AND ("score" IS NULL OR "score" < 8.8);--> statement-breakpoint
UPDATE "deals" SET "score" = 8.6 WHERE "slug" = 'jewellery-pre-ipo' AND ("score" IS NULL OR "score" < 8.6);--> statement-breakpoint
UPDATE "deals" SET "score" = 8.5 WHERE "slug" = 'ai-collections-software' AND ("score" IS NULL OR "score" < 8.5);--> statement-breakpoint
UPDATE "deals" SET "score" = 8.3 WHERE "slug" = 'waste-management-growth-round' AND ("score" IS NULL OR "score" < 8.3);--> statement-breakpoint
UPDATE "deals" SET "score" = 8.2 WHERE "slug" = 'edible-oils-pre-ipo' AND ("score" IS NULL OR "score" < 8.2);--> statement-breakpoint
UPDATE "deals" SET "score" = 8.0 WHERE "slug" = 'ethanol-distillery-pre-ipo' AND ("score" IS NULL OR "score" < 8.0);--> statement-breakpoint
UPDATE "deals" SET "score" = 8.0 WHERE "score" IS NOT NULL AND "score" < 8.0;
