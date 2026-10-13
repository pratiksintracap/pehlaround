UPDATE "articles" SET "body" = replace("body", 'Every room carries the company''s own NDA, the desk''s diligence tracker and the risks it sees.', 'Every room carries the desk''s diligence tracker and the risks it sees.');--> statement-breakpoint
UPDATE "settings" SET "value" = replace("value", 'One NDA per company, signed on screen.', 'The NDA is signed on screen.') WHERE "key" = 'promises';
