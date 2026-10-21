ALTER TABLE "offices" ADD COLUMN "added_by_id" integer;--> statement-breakpoint
UPDATE "offices" o SET "added_by_id" = u."id" FROM "users" u WHERE o."origin" = 'desk' AND o."added_by_id" IS NULL AND u."name" = o."added_by" AND u."role" IN ('admin', 'analyst');
