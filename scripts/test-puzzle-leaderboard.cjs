/* eslint-disable @typescript-eslint/no-require-imports -- Exercise leaderboard queries without a live database. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

function loadSource(relative, overrides = {}) {
    const filename = path.resolve(__dirname, relative);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const loaded = new Module(filename, module);
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : originalRequire(name);
    loaded._compile(output, filename);
    return loaded.exports;
}

const weekModule = loadSource('../src/lib/leaderboardWeeks.ts');
const { planBackfill } = require('./backfill-puzzle-challenge.cjs');
const group = (userId, points, challengePoints, success = true) => ({
    userId, success, _sum: { points, challengePoints }, _count: { challengePoints: challengePoints === null ? 0 : 1 },
});

function statistics(rows) {
    return loadSource('../src/app/actions/statistics.ts', {
        '@/lib/leaderboardWeeks': weekModule,
        '@/lib/db': { prisma: {
            puzzleAttempt: { groupBy: async query => {
                if (query.by.length === 1) {
                    assert.equal(query.where.success, true);
                    assert.deepEqual(query._sum, {points:true});
                    return rows.filter(row => row.success).sort((a,b)=>b._sum.points-a._sum.points).slice(0,query.take);
                }
                assert.deepEqual(query.by, ['userId', 'success']);
                assert.deepEqual(query._sum, { points: true, challengePoints: true });
                return rows;
            } },
            practiceLineProgress: { groupBy: async () => [] },
            user: { findUnique: async ({ where }) => ({ name: where.id, image: null, lichessId: null }) },
        } },
    });
}

test('weekly awards use challenge totals, ignore failures, and do not mix in legacy rating gains', async () => {
    const { puzzleWinners } = await statistics([
        group('new', 500, 10), group('established', 5, 30), group('legacy', 900, null),
        group('failed', -20, 0, false), group('too-easy', 1, 0),
    ]).getWeeklyStatistics();
    assert.deepEqual(puzzleWinners.map(({ id, points }) => ({ id, points })), [
        { id: 'established', points: 30 }, { id: 'new', points: 10 },
    ]);
});

test('historical weeks retain their original winners and points', async () => {
    const { puzzleWinners } = await statistics([
        group('a', 50, null), group('b', 200, null), group('b', -90, null, false),
    ]).getWeeklyStatistics();
    assert.deepEqual(puzzleWinners.map(({ id, points }) => ({ id, points })), [
        { id: 'b', points: 200 }, { id: 'a', points: 50 },
    ]);
});

test('legacy zero-score awards are retained rather than rewriting historical wins', async () => {
    const { puzzleWinners } = await statistics([group('legacy', 0, null)]).getWeeklyStatistics();
    assert.equal(puzzleWinners[0].id, 'legacy');
    assert.equal(puzzleWinners[0].points, 0);
});

test('a new-scoring week with only failures or zero-point solves does not award legacy points', async () => {
    for (const success of [false, true]) {
        const { puzzleWinners } = await statistics([group('legacy', 1000, null), group('current', 0, 0, success)]).getWeeklyStatistics();
        assert.deepEqual(puzzleWinners, []);
    }
});

test('weekly awards take the top three challenge scores with deterministic ties', async () => {
    const { puzzleWinners } = await statistics([
        group('d', 200, 10), group('c', 300, 20), group('b', 10, 30), group('a', 0, 30),
    ]).getWeeklyStatistics();
    assert.deepEqual(puzzleWinners.map(row => row.id), ['a', 'b', 'c']);
});

test('leaderboard uses stored challenge points and retains students outside the lifetime top 20', async () => {
    const students = Array.from({ length: 25 }, (_, index) => ({
        id: String(index), name: `Student ${index}`, image: null, _count: { puzzleAttempts: 12 },
        puzzleAttempts: [
            { success: true, points: 300, challengePoints: null },
            { success: true, points: 4, challengePoints: index === 24 ? 45 : 10 },
            { success: false, points: -10, challengePoints: 0 },
        ],
        practiceAttempts: [], practiceProgress: [],
    }));
    const { getLeaderboardData } = loadSource('../src/app/actions/leaderboard.ts', {
        '@/lib/leaderboardWeeks': weekModule,
        '@/lib/leaderboardExclusions': { getExcludedLichessIds: async () => ['coach'] },
        '@/lib/db': { prisma: {
            user: { findMany: async query => {
                if (!query.select.name) {
                    assert.deepEqual(query.where.lichessId.notIn, ['coach']);
                    return students.map(({ id }) => ({ id }));
                }
                assert.equal(query.select.puzzleAttempts.select.challengePoints, true);
                const range = query.select.puzzleAttempts.where.createdAt;
                const week = weekModule.getLeaderboardWeek();
                assert.equal(range.gte.toISOString(), week.startDate.toISOString());
                assert.equal(range.lt.toISOString(), week.endDate.toISOString());
                return students;
            } },
            puzzleAttempt: { groupBy: async query => {
                assert.deepEqual(query._sum, { challengePoints: true });
                return students.map(({ id }) => ({ userId: id, _sum: { challengePoints: Number(id) === 24 ? 0 : 100 } }));
            } },
        } },
    });
    const result = await getLeaderboardData();
    assert.equal(result.length, 25);
    const weeklyWinner = result.find(row => row.id === '24');
    assert.equal(weeklyWinner.puzzleStats.weekly.points, 45);
    assert.equal(weeklyWinner.puzzleStats.allTime.points, 0);
    assert.equal(result[0].puzzleStats.weekly.points, 10);
});

test('backfill reconstructs pre-attempt ratings, includes later losses, and excludes retries', () => {
    const row = (id, createdAt, points, overrides = {}) => ({
        id, userId: 'a', name: 'Student', success: true, firstAttempt: true,
        currentStudentRating: 1550, currentPuzzleRating: 1750, challengePoints: null,
        createdAt: new Date(createdAt), points, ...overrides,
    });
    const plan = planBackfill([
        row('later-week', '2026-10-26T12:00:00Z', 100),
        row('failed', '2026-10-20T12:00:00Z', -50, {success:false}),
        row('retry', '2026-10-20T11:00:00Z', 0, {firstAttempt:false}),
        row('solve', '2026-10-19T12:00:00Z', 10),
        row('before-week', '2026-10-18T20:59:59.999Z', 10),
    ]);
    assert.deepEqual(plan.map(row => [row.id, row.challengeStudentRating, row.challengePoints]), [
        ['failed', 1500, 0], ['retry', 1500, 0], ['solve', 1490, 15],
    ]);
});

test('backfill is idempotent and keeps students independent at the exact local Monday boundary', () => {
    const base = {success:true,firstAttempt:true,currentStudentRating:1500,currentPuzzleRating:1500,points:0,challengePoints:null};
    const plan = planBackfill([
        {...base,id:'already-scored',userId:'a',createdAt:new Date('2026-10-20T12:00:00Z'),challengePoints:10,points:50},
        {...base,id:'b',userId:'b',createdAt:new Date('2026-10-18T21:00:00Z')},
        {...base,id:'a',userId:'a',createdAt:new Date('2026-10-18T21:00:00Z')},
    ]);
    assert.deepEqual(plan.map(row => [row.id,row.challengeStudentRating,row.challengePoints]), [['b',1500,10],['a',1450,10]]);
    assert.deepEqual(planBackfill([{...base,id:'done',userId:'a',createdAt:new Date('2026-10-19T12:00:00Z'),challengePoints:0}]), []);
});
