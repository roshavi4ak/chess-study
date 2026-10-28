-- Additive: existing results, ratings, and counters remain intact.
ALTER TABLE "PuzzleAttempt" ADD COLUMN IF NOT EXISTS "moveErrors" JSONB;
ALTER TABLE "PracticeAttempt" ADD COLUMN IF NOT EXISTS "moveErrors" JSONB;
ALTER TABLE "PracticeAttempt" ADD COLUMN IF NOT EXISTS "finalMove" TEXT;
