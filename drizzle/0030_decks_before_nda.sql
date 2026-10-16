-- Pitch decks, teasers and company presentations are seen by approved investors before any NDA (layer 2).
-- Information memoranda, financials and everything else stay under the NDA.
UPDATE "documents" SET "audience" = 'approved' WHERE "audience" = 'nda' AND ("title" ~* '(pitch|investor|company)[ -]?(deck|presentation)' OR "title" ~* '^(investor )?teaser$' OR "title" ~* '^deck$');
