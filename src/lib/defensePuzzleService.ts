import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import { DEFENSE_LEVELS, prepareDefensePuzzle, type DefensePuzzleCandidate } from "./defensePuzzles";

export async function loadDefensePuzzles(level: number, exclude: string[] = []) {
    const band = DEFENSE_LEVELS.find(item => item.level === level);
    if (!band || level < 2) throw new Error("Invalid defense level");
    const rows = await prisma.$queryRaw<DefensePuzzleCandidate[]>(Prisma.sql`
        SELECT id, name, fen, solution, rating, tags FROM "Puzzle"
        WHERE rating >= ${band.min} AND rating < ${band.max}
        AND 'defensiveMove' = ANY(tags)
        AND NOT (id = ANY(${exclude.slice(0, 100)}::text[]))
        ORDER BY random() LIMIT 180
    `);
    const puzzles = [];
    for (const row of rows) {
        const puzzle = prepareDefensePuzzle(row, level);
        if (puzzle) puzzles.push(puzzle);
        if (puzzles.length === 5) break;
    }
    return puzzles;
}
