import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { pickLadder, type LadderPuzzle } from "@/lib/puzzleLadder";
import { levelRatingRange, selectLevelExercises, type LevelPuzzleCandidate } from "./levelExercises";
import type { CurriculumLevel } from "./curriculum";

const POOL_SIZE = 400;
// Narrow topics (e.g. knight mates) are a small share of their tags, so those levels read the whole band.
const FOCUSED_POOL_SIZE = 4000;

// Curriculum tests stay within the lesson's difficulty band and carry an explicit topic.
export async function loadLevelExercises(level: CurriculumLevel, start: number) {
    const { min, max } = levelRatingRange(start);
    const tagFilter = level.tags.length ? Prisma.sql`AND tags && ${level.tags}::text[]` : Prisma.empty;
    const pool = await prisma.$queryRaw<LevelPuzzleCandidate[]>(Prisma.sql`
        SELECT id, fen, solution, rating, tags FROM "Puzzle"
        WHERE rating BETWEEN ${min} AND ${max}
        ${tagFilter}
        ORDER BY random()
        LIMIT ${level.only || level.mix ? FOCUSED_POOL_SIZE : POOL_SIZE}
    `);
    return selectLevelExercises(pool, level, start);
}

// Puzzles of rising difficulty (unrated modes). Server-side only.
export async function loadPuzzleLadder({ start, step, count, tags }: { start: number; step: number; count: number; tags?: string[] }): Promise<LadderPuzzle[]> {
    const safeCount = Math.min(Math.max(1, Math.round(count)), 100);
    const to = start + step * safeCount + 200;
    const tagFilter = tags?.length ? Prisma.sql`AND tags && ${tags}::text[]` : Prisma.empty;
    const pool = await prisma.$queryRaw<LadderPuzzle[]>(Prisma.sql`
        SELECT id, fen, solution, rating FROM "Puzzle"
        WHERE rating BETWEEN ${start - 150} AND ${to}
        ${tagFilter}
        ORDER BY random()
        LIMIT ${POOL_SIZE}
    `);
    return pickLadder(pool, start, step, safeCount);
}

// Puzzles by id, in the given order.
export async function loadPuzzlesInOrder(ids: string[]): Promise<LadderPuzzle[]> {
    const rows = await prisma.puzzle.findMany({ where: { id: { in: ids } }, select: { id: true, fen: true, solution: true, rating: true } });
    const byId = new Map(rows.map(row => [row.id, row]));
    return ids.map(id => byId.get(id)).filter((row): row is LadderPuzzle => !!row);
}
