-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create UserTagStats table
CREATE TABLE "UserTagStats" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "unsolvedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create unique index for userId and tag combination
CREATE UNIQUE INDEX "UserTagStats_userId_tag_key" ON "UserTagStats"("userId", "tag");

-- Create index for userId for faster queries
CREATE INDEX "UserTagStats_userId_idx" ON "UserTagStats"("userId");