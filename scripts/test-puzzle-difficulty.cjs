/* eslint-disable @typescript-eslint/no-require-imports -- Exercise policy, SQL bounds and action permissions without a live database. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
function loadSource(relative, overrides = {}) {
    const file = path.resolve(__dirname, relative), mod = new Module(file, module);
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    const original = mod.require.bind(mod);
    mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, file);
    return mod.exports;
}
const policy = loadSource('../src/lib/puzzleDifficulty.ts');
test('default selection follows the latest rating, prefers +100, and never selects below the student', () => {
    assert.deepEqual(policy.puzzleRatingRange(1363, null), { ...policy.DEFAULT_PUZZLE_DIFFICULTY, studentRating: 1363, min: 1363, max: 1663, target: 1463 });
    assert.equal(policy.puzzleRatingRange(1410, null).target, 1510);
    assert.equal(policy.puzzleRatingRange(null, null).studentRating, 1500);
    assert.equal(policy.puzzleRatingRange(0, null).studentRating, 0, 'zero is not a missing rating');
});
test('coach settings reject invalid bounds and unsupported targets; malformed storage uses safe defaults', () => {
    for (const change of [{ minOffset: -601 }, { maxOffset: 1001 }, { minOffset: 301 }, { preferredOffset: 301 }, { preferredOffset: NaN }, { preferredOffset: 0.5 }, { maxOffset: '300' }, { allowStudentChoice: 'true' }]) {
        const invalid = { ...policy.DEFAULT_PUZZLE_DIFFICULTY, ...change };
        assert(!policy.isPuzzleDifficulty(invalid));
        assert.deepEqual(policy.puzzleDifficulty(invalid), policy.DEFAULT_PUZZLE_DIFFICULTY);
    }
    const range = policy.puzzleRatingRange(100, { minOffset: -200, maxOffset: 200, preferredOffset: -100, allowStudentChoice: false });
    assert.equal(range.min, 0); assert.equal(range.target, 0); assert.equal(range.max, 300);
});
function selection({ user = { ratingPuzzle: 1363, puzzleDifficulty: null }, rows = [] } = {}) {
    const queries = [], users = [];
    const service = loadSource('../src/lib/puzzles.ts', {
        './puzzleDifficulty': policy,
        '@/lib/db': { prisma: {
            user: { findUnique: async input => { users.push(input); return user; } },
            $queryRaw: async query => { queries.push(query); return rows; },
        } },
    });
    return { ...service, queries, users };
}
test('automatic puzzle SQL has hard limits, an unseen-only condition, topic and current-puzzle exclusions', async () => {
    const service = selection({ rows: [{ name: 'new-puzzle' }] });
    const result = await service.getNextPuzzleSelection({ userId: 'student', tag: "fork' OR true --", excludeName: 'current' });
    assert.equal(result.name, 'new-puzzle');
    assert.equal(service.users[0].where.id, 'student');
    assert.equal(service.users[0].select.ratingPuzzle, true);
    assert.equal(service.users[0].select.puzzleDifficulty, true);
    const query = service.queries[0];
    assert.match(query.sql, /p\.rating BETWEEN \? AND \?/);
    assert.match(query.sql, /NOT EXISTS/); assert.match(query.sql, /ANY\(p.tags\)/);
    assert.match(query.sql, /p\.name !=/); assert.match(query.sql, /ABS\(p.rating - \?\)/);
    assert.deepEqual(query.values, [1363, 1663, 'student', "fork' OR true --", 'current', 1463]);
    assert(!query.sql.includes("fork' OR true"), 'filters are parameterized');
});
test('an exhausted or rare topic returns no puzzle without widening limits or repeating solved positions', async () => {
    const service = selection();
    const result = await service.getNextPuzzleSelection({ userId: 'student', tag: 'rare' });
    assert.equal(result.name, null); assert.equal(service.queries.length, 1);
    assert.equal(result.range.min, 1363); assert.equal(result.range.max, 1663);
});
test('coach bounds and student preference drive selection; guests retain a bounded default', async () => {
    const settings = { minOffset: -100, maxOffset: 500, preferredOffset: 300, allowStudentChoice: true };
    const service = selection({ user: { ratingPuzzle: 1900, puzzleDifficulty: settings } });
    const result = await service.getNextPuzzleSelection({ userId: 'student' });
    assert.equal(result.range.min, 1800); assert.equal(result.range.max, 2400); assert.equal(result.range.target, 2200);
    const guest = selection(); const anonymous = await guest.getNextPuzzleSelection({});
    assert.equal(guest.users.length, 0); assert.equal(anonymous.range.min, 1500); assert.equal(anonymous.range.max, 1800);
});
for (const routeName of ['next', 'random']) test(`${routeName} API ignores client user/rating overrides and prevents caching`, async () => {
    let selected;
    const route = loadSource(`../src/app/api/puzzles/${routeName}/route.ts`, {
        '@/auth': { auth: async () => ({ user: { id: 'real-user', ratingPuzzle: 600 } }) },
        '@/lib/puzzles': { getNextPuzzleSelection: async options => { selected = options; return { name: null, range: { min: 1500, max: 1800 } }; } },
        'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    });
    const result = await route.GET(new Request('https://example.test/api/puzzles/'+routeName+'?rating=400&userId=someone-else&tag=fork&exclude=current'));
    assert.deepEqual(selected, { userId: 'real-user', tag: 'fork', excludeName: 'current' });
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.deepEqual(result.body.range, { min: 1500, max: 1800 });
});
function actions({ role = 'STUDENT', authenticated = true, settings = null, targetRole = 'STUDENT', onLock } = {}) {
    let stored = settings; const writes = [], calls = [];
    const database = {
        $queryRaw: async () => { calls.push('lock'); if (onLock) stored = onLock(); return []; },
        user: {
            findUnique: async ({ where }) => { calls.push('read'); return { id: where.id, role: targetRole, ratingPuzzle: 1363, puzzleDifficulty: stored }; },
            update: async input => { calls.push('write'); stored = input.data.puzzleDifficulty; writes.push(input); },
        },
    };
    const actionModule = loadSource('../src/app/actions/puzzleDifficulty.ts', {
        '@/auth': { auth: async () => authenticated ? { user: { id: 'me', role } } : null },
        '@/lib/db': { prisma: { ...database, $transaction: async callback => callback(database) } },
        '@/lib/puzzleDifficulty': policy, 'next/cache': { revalidatePath() {} },
    });
    return { ...actionModule, writes, calls };
}
test('students save only a target inside their coach limits, retaining permissions and limits', async () => {
    const a = actions(); const result = await a.savePuzzleDifficulty({ preferredOffset: 300 });
    assert.equal(result.view.target, 1663);
    assert.equal(a.writes[0].where.id, 'me');
    assert.deepEqual(a.writes[0].data.puzzleDifficulty, { ...policy.DEFAULT_PUZZLE_DIFFICULTY, preferredOffset: 300 });
    assert.deepEqual(a.calls, ['lock', 'read', 'write']);
    for (const payload of [{ preferredOffset: -1 }, { preferredOffset: 301 }, { preferredOffset: 100, minOffset: -600 }, { preferredOffset: 100, allowStudentChoice: true }]) {
        const denied = actions(); assert.equal((await denied.savePuzzleDifficulty(payload)).error, 'invalid'); assert.equal(denied.writes.length, 0);
    }
});
test('student access to another account and signed-out access are denied without reading or writing', async () => {
    const a = actions(); assert.equal((await a.getPuzzleDifficulty('other')).error, 'unauthorized');
    assert.equal((await a.savePuzzleDifficulty({ preferredOffset: 100 }, 'other')).error, 'unauthorized');
    assert.deepEqual(a.calls, []);
    const guest = actions({ authenticated: false }); assert.equal((await guest.getPuzzleDifficulty()).error, 'unauthorized');
    assert.equal((await guest.savePuzzleDifficulty({ preferredOffset: 100 })).error, 'unauthorized'); assert.deepEqual(guest.calls, []);
});
test('coach limits and lock are enforced even when they changed after the student opened settings', async () => {
    const a = actions({ onLock: () => ({ ...policy.DEFAULT_PUZZLE_DIFFICULTY, allowStudentChoice: false }) });
    assert.equal((await a.savePuzzleDifficulty({ preferredOffset: 300 })).error, 'locked'); assert.equal(a.writes.length, 0);
    const tighter = actions({ onLock: () => ({ minOffset: 0, maxOffset: 100, preferredOffset: 100, allowStudentChoice: true }) });
    assert.equal((await tighter.savePuzzleDifficulty({ preferredOffset: 300 })).error, 'invalid'); assert.equal(tighter.writes.length, 0);
});
test('coaches can set a student policy and lock choice, but cannot use student management to edit other coaches', async () => {
    const a = actions({ role: 'COACH' }); const settings = { minOffset: 100, maxOffset: 500, preferredOffset: 300, allowStudentChoice: false };
    const result = await a.savePuzzleDifficulty(settings, 'student');
    assert.equal(result.view.canEditLimits, true); assert.equal(result.view.min, 1463); assert.equal(a.writes[0].where.id, 'student');
    const denied = actions({ role: 'COACH', targetRole: 'COACH' });
    assert.equal((await denied.savePuzzleDifficulty(settings, 'coach')).error, 'notFound'); assert.equal(denied.writes.length, 0);
});
