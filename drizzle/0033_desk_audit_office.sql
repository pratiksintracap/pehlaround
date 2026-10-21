-- Desk changes about an office keep the office in detail.officeId, not audit.office_id (which marks the office's own actions,
-- shown in its Log tab and export). Moves any such rows written since 0032.
UPDATE "audit" SET "detail" = coalesce("detail", '{}'::jsonb) || jsonb_build_object('officeId', "office_id"), "office_id" = NULL
  WHERE "entity" IS NOT NULL AND "office_id" IS NOT NULL;
