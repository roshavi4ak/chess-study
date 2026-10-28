-- Additive, repeatable update. Existing challenges, points and student activity are unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS "ClubTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClubTeamMember" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ClubTeamMember_pkey" PRIMARY KEY ("teamId", "userId"),
    CONSTRAINT "ClubTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ClubTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ClubTeamMember_userId_idx" ON "ClubTeamMember"("userId");
COMMIT;
