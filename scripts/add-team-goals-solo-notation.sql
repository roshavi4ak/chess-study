-- Solo chess, notation trainer, team challenges and club goals (20 October 2026).
-- Additive and compatible with the previous application; safe to run more than once.

-- New play-session kinds. Kept outside the transaction so they work on every PostgreSQL version.
ALTER TYPE "PlayKind" ADD VALUE IF NOT EXISTS 'SOLO_CHESS';
ALTER TYPE "PlayKind" ADD VALUE IF NOT EXISTS 'NOTATION';

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS "TeamChallenge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "tag" TEXT,
    "practiceId" TEXT,
    "scoring" TEXT NOT NULL DEFAULT 'TOTAL',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChallengeTeam" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ChallengeTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChallengeTeamMember" (
    "challengeId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ChallengeTeamMember_pkey" PRIMARY KEY ("challengeId", "userId")
);

CREATE TABLE IF NOT EXISTS "ClubGoal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "tag" TEXT,
    "practiceId" TEXT,
    "target" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamChallenge_endsOn_idx" ON "TeamChallenge"("endsOn");
CREATE INDEX IF NOT EXISTS "ChallengeTeam_challengeId_idx" ON "ChallengeTeam"("challengeId");
CREATE INDEX IF NOT EXISTS "ChallengeTeamMember_teamId_idx" ON "ChallengeTeamMember"("teamId");
CREATE INDEX IF NOT EXISTS "ChallengeTeamMember_userId_idx" ON "ChallengeTeamMember"("userId");
CREATE INDEX IF NOT EXISTS "ClubGoal_endsOn_idx" ON "ClubGoal"("endsOn");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallengeTeam_challengeId_fkey') THEN
        ALTER TABLE "ChallengeTeam" ADD CONSTRAINT "ChallengeTeam_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "TeamChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallengeTeamMember_challengeId_fkey') THEN
        ALTER TABLE "ChallengeTeamMember" ADD CONSTRAINT "ChallengeTeamMember_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "TeamChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallengeTeamMember_teamId_fkey') THEN
        ALTER TABLE "ChallengeTeamMember" ADD CONSTRAINT "ChallengeTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ChallengeTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallengeTeamMember_userId_fkey') THEN
        ALTER TABLE "ChallengeTeamMember" ADD CONSTRAINT "ChallengeTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;
