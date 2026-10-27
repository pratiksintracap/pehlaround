-- Armsoftech round confirmed at ₹35 Cr (was ₹30 Cr), pre-money unchanged at ₹150 Cr, so ₹185 Cr post-money.
-- Touches only what still reads the old figures, so a desk edit made since is kept.
UPDATE "deals" SET "round_label" = '₹35 Cr' WHERE "slug" = 'ai-collections-software' AND "round_label" = '₹30 Cr';--> statement-breakpoint
UPDATE "deals" SET "round_cr" = 35 WHERE "slug" = 'ai-collections-software' AND ("round_cr" IS NULL OR "round_cr" = 30);--> statement-breakpoint
UPDATE "deals" SET "room" = replace(replace(replace("room"::text, '₹30 Cr', '₹35 Cr'), '₹180 Cr post-money', '₹185 Cr post-money'), '"postCr": 180', '"postCr": 185')::jsonb WHERE "slug" = 'ai-collections-software';--> statement-breakpoint
UPDATE "deals" SET "room" = jsonb_set("room", '{stake,sizeCr}', '35') WHERE "slug" = 'ai-collections-software' AND "room" #>> '{stake,sizeCr}' = '30';
