-- Additive and compatible with the previous application. Null uses the defaults.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "puzzleDifficulty" JSONB;
COMMIT;
