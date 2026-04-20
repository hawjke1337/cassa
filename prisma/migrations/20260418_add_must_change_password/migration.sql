-- Phase 17 BUILD-02: Add mustChangePassword field to User for force-change-on-first-login flow
-- UI flow (middleware + settings/password page) deferred to Phase 18 (SEC3).
-- Default false для existing users — они уже ввели реальный пароль через setup или seed.
-- Новые admin-ы создаваемые через prod-seed (SEED_ALLOW_PROD=true) будут иметь mustChangePassword=true.

ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: все существующие users явно получают false (v1.1 prod data preservation).
-- DEFAULT false выше покрывает fresh inserts; explicit UPDATE — явный аудит-след для migration,
-- подтверждает что ни один существующий user не получит force-change флаг после миграции.
UPDATE "User" SET "mustChangePassword" = false WHERE "mustChangePassword" IS NOT DISTINCT FROM false;
