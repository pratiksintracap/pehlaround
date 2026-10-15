-- Public headlines that could identify two companies are softened. Only rows still carrying the old text change,
-- so an edit the desk has since made is left alone.
UPDATE "deals" SET "headline" = 'Large grain-based distillery making extra neutral alcohol and fuel ethanol, running at full capacity and raising ahead of a main-board listing.', "updated_at" = now() WHERE "headline" = '245 KLPD grain distillery making extra neutral alcohol and fuel ethanol, raising ahead of a main-board listing.';--> statement-breakpoint
UPDATE "deals" SET "headline" = 'Edible-oil refiner expanding its refining capacity ahead of a listing.', "updated_at" = now() WHERE "headline" = 'Groundnut-oil refiner moved from a proprietorship into a public company in 2025, expanding capacity ahead of a listing.';
