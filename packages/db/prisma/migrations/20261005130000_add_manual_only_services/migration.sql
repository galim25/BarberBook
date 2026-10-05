-- AlterTable
ALTER TABLE "services" ADD COLUMN     "is_manual_only" BOOLEAN NOT NULL DEFAULT false;

-- Hidden services backing the barber's manual-appointment durations (MANUAL_SERVICE_DEFINITIONS
-- in packages/shared). Inserted here so they exist right after `pnpm db:migrate`, without a re-seed.
INSERT INTO "services" ("id", "name", "duration_minutes", "is_child_service", "is_manual_only", "created_at", "updated_at") VALUES
  ('manual_5',  'תור ידני 5 דק''',  5,  false, true, NOW(), NOW()),
  ('manual_10', 'תור ידני 10 דק''', 10, false, true, NOW(), NOW()),
  ('manual_15', 'תור ידני 15 דק''', 15, false, true, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
