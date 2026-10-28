-- Additive only: existing rating changes, ratings and attempts are preserved.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "PuzzleAttempt"
    ADD COLUMN IF NOT EXISTS "challengePoints" INTEGER,
    ADD COLUMN IF NOT EXISTS "challengeStudentRating" INTEGER,
    ADD COLUMN IF NOT EXISTS "challengePuzzleRating" INTEGER,
    ADD COLUMN IF NOT EXISTS "challengeBackfilled" BOOLEAN NOT NULL DEFAULT false;
COMMIT;
