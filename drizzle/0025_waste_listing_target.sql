-- LAHS (waste management, coming to the desk): target listing September 2027. Only changes the row if it has no target year yet.
UPDATE "deals" SET "listing_label" = 'September 2027', "listing_month" = '2027-09', "updated_at" = now() WHERE "slug" = 'waste-management-growth-round' AND "listing_label" !~ '20[0-9][0-9]';
