import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function getNextPuzzleName({
    userId,
    rating = 1500,
    tag,
    excludeName
}: {
    userId?: string;
    rating?: number;
    tag?: string;
    excludeName?: string;
}) {
    // Build filter components for Raw SQL
    // We use a subquery for seen puzzles to avoid multiple DB round-trips and handle any number of seen puzzles efficiently
    const seenFilter = userId
        ? Prisma.sql`AND id NOT IN (SELECT "puzzleId" FROM "PuzzleAttempt" WHERE "userId" = ${userId})`
        : Prisma.empty;

    // Database tags are stored as a PostgreSQL array of strings
    const tagFilter = tag ? Prisma.sql`AND ${tag} = ANY(tags)` : Prisma.empty;
    const excludeFilter = excludeName ? Prisma.sql`AND name != ${excludeName}` : Prisma.empty;

    // Use a single query with ORDER BY ABS distance to find the closest puzzles by rating
    // This replaces the previous incremental +100 range widening logic
    let puzzles = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT name FROM "Puzzle"
        WHERE 1=1
        ${seenFilter}
        ${tagFilter}
        ${excludeFilter}
        ORDER BY ABS(rating - ${rating})
        LIMIT 50
    `);

    // Fallback: If no unseen puzzles match the criteria (e.g. user has seen all puzzles in a category),
    // allow seen puzzles while still respecting other filters like tag and excludeName.
    if (puzzles.length === 0) {
        puzzles = await prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT name FROM "Puzzle"
            WHERE 1=1
            ${tagFilter}
            ${excludeFilter}
            ORDER BY ABS(rating - ${rating})
            LIMIT 50
        `);
    }

    if (puzzles.length > 0) {
        // Pick one randomly from the top 50 closest candidates to provide variety 
        // and avoid the user getting the exact same puzzle every time if multiple match.
        const randomIndex = Math.floor(Math.random() * puzzles.length);
        return puzzles[randomIndex].name || null;
    }

    return null;
}
