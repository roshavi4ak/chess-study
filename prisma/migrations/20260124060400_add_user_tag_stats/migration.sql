-- CreateTable
CREATE TABLE "UserTagStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "unsolvedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserTagStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTagStats_userId_idx" ON "UserTagStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTagStats_userId_tag_key" ON "UserTagStats"("userId", "tag");

-- AddForeignKey
ALTER TABLE "UserTagStats" ADD CONSTRAINT "UserTagStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;