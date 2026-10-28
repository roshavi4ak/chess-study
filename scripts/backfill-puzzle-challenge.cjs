/* eslint-disable @typescript-eslint/no-require-imports -- Run an explicit, preview-first maintenance operation. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/lib/puzzleChallenge.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { puzzleChallengePoints } = loaded.exports;

const START = new Date('2026-10-18T21:00:00.000Z'); // Monday 19 October, 00:00 Europe/Sofia.
const END = new Date('2026-10-25T22:00:00.000Z'); // Following Monday, after the DST transition.

// Rows must include ALL later rating changes (including after END), in reverse
// chronological order. Keep failures/retries in the replay, but never reward them.
function planBackfill(rows) {
    const ratings = new Map();
    return rows.flatMap(row => {
        const after = ratings.get(row.userId) ?? row.currentStudentRating ?? 1500;
        const before = after - row.points;
        ratings.set(row.userId, before);
        if (row.challengePoints !== null || row.createdAt < START || row.createdAt >= END) return [];
        const challengePoints = row.success && row.firstAttempt ? puzzleChallengePoints(before, row.currentPuzzleRating) : 0;
        return [{
            id: row.id, userId: row.userId, name: row.name, success: row.success,
            legacyRatingChange: row.points,
            challengePoints, challengeStudentRating: before, challengePuzzleRating: row.currentPuzzleRating,
        }];
    });
}

async function main() {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--apply')) throw new Error('Usage: node scripts/backfill-puzzle-challenge.cjs [--apply]');
    const apply = args.includes('--apply');
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    try {
        const report = await db.$transaction(async tx => {
            if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
            await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
            const rows = await tx.$queryRawUnsafe(`
                SELECT a.id, a."userId", a.success, a.points, a."createdAt", a."challengePoints", u.name,
                    u."ratingPuzzle" AS "currentStudentRating", p.rating AS "currentPuzzleRating",
                    NOT EXISTS (
                        SELECT 1 FROM "PuzzleAttempt" older
                        WHERE older."userId" = a."userId" AND older."puzzleId" = a."puzzleId"
                        AND (older."createdAt" < a."createdAt" OR (older."createdAt" = a."createdAt" AND older.id < a.id))
                    ) AS "firstAttempt"
                FROM "PuzzleAttempt" a JOIN "User" u ON u.id = a."userId"
                JOIN "Puzzle" p ON p.id = a."puzzleId"
                WHERE a."createdAt" >= $1 AND u.role = 'STUDENT'
                ORDER BY a."createdAt" DESC, a.id DESC
            `, START);
            const plan = planBackfill(rows);
            if (apply && plan.length) {
                // Only populate still-null competition columns; never touch ratings or legacy points.
                const changed = await tx.$executeRawUnsafe(`
                    UPDATE "PuzzleAttempt" a SET
                        "challengePoints" = x."challengePoints",
                        "challengeStudentRating" = x."challengeStudentRating",
                        "challengePuzzleRating" = x."challengePuzzleRating",
                        "challengeBackfilled" = true
                    FROM jsonb_to_recordset($1::jsonb) AS x(
                        id text, "challengePoints" integer, "challengeStudentRating" integer, "challengePuzzleRating" integer
                    ) WHERE a.id = x.id AND a."challengePoints" IS NULL
                `, JSON.stringify(plan));
                if (changed !== plan.length) throw new Error('Concurrent changes detected; conversion rolled back.');
            }
            const students = new Map();
            for (const row of plan) {
                const student = students.get(row.userId) ?? { name: row.name, attempts: 0, legacyPoints: 0, challengePoints: 0 };
                student.attempts++;
                student.legacyPoints += row.success ? row.legacyRatingChange : 0;
                student.challengePoints += row.challengePoints;
                students.set(row.userId, student);
            }
            return {
                mode: apply ? 'applied' : 'preview', from: START, untilExclusive: END,
                puzzleRatingSource: 'current puzzle rating at conversion (historical approximation)',
                convertedAttempts: plan.length, scoringSolves: plan.filter(row => row.challengePoints > 0).length,
                students: [...students.values()].sort((a, b) => b.challengePoints - a.challengePoints),
                attempts: plan,
            };
        }, { isolationLevel: 'RepeatableRead', timeout: 40000 });
        console.log(JSON.stringify(report, null, 2));
    } finally {
        await db.$disconnect();
    }
}

module.exports = { planBackfill };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
