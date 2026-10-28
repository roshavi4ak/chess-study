import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { puzzleRatingRange } from "./puzzleDifficulty";

export async function getNextPuzzleSelection({ userId, tag, excludeName }: {
    userId?: string; tag?: string; excludeName?: string;
}) {
    // Always read the latest rating and limits; client and session ratings can be stale.
    const user = userId ? await prisma.user.findUnique({
        where: { id: userId }, select: { ratingPuzzle: true, puzzleDifficulty: true },
    }) : null;
    const range = puzzleRatingRange(user?.ratingPuzzle, user?.puzzleDifficulty);
    const seenFilter = userId
        ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "PuzzleAttempt" a WHERE a."userId" = ${userId} AND a."puzzleId" = p.id)`
        : Prisma.empty;
    const tagFilter = tag ? Prisma.sql`AND ${tag} = ANY(p.tags)` : Prisma.empty;
    const excludeFilter = excludeName ? Prisma.sql`AND p.name != ${excludeName}` : Prisma.empty;
    const puzzles = await prisma.$queryRaw<{ name: string }[]>(Prisma.sql`
        SELECT p.name FROM "Puzzle" p
        WHERE p.rating BETWEEN ${range.min} AND ${range.max}
        ${seenFilter} ${tagFilter} ${excludeFilter}
        ORDER BY ABS(p.rating - ${range.target}), random()
        LIMIT 50
    `);
    // No widening or silent repeats. Reviews have a separate, unrated queue.
    const name = puzzles[Math.floor(Math.random() * puzzles.length)]?.name ?? null;
    return { name, range };
}
