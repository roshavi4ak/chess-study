/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the route without a database or server. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test, beforeEach } = require('node:test');
const ts = require('typescript');

function loadSource(relativePath, overrides = {}) {
    const filename = path.resolve(__dirname, relativePath);
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

let session, existingAttempt, writes;
const user = { ratingPuzzle: 1500, puzzleRd: 350, puzzleVolatility: 0.06 };
const puzzle = { id: 'puzzle', rating: 1500, ratingDeviation: 350, volatility: 0.06, tags: ['fork'] };
const record = table => async args => { writes.push({ table, ...args }); };
const { POST } = loadSource('../src/app/api/puzzles/submit/route.ts', {
    '@/auth': { auth: async () => session },
    '@/lib/db': { prisma: {
        user: { findUnique: async () => user, update: record('user') },
        puzzle: { findUnique: async () => puzzle, update: record('puzzle') },
        puzzleAttempt: { findFirst: async () => existingAttempt, create: record('puzzleAttempt') },
        userTagStats: { upsert: record('userTagStats') },
    } },
    '@/lib/glicko2': loadSource('../src/lib/glicko2.ts'),
    'next/server': { NextResponse: Response },
});

beforeEach(() => {
    session = { user: { id: 'student' } };
    existingAttempt = null;
    writes = [];
});
const submit = body => POST(new Request('http://localhost/api/puzzles/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

for (const success of [false, true]) {
    test(`hint with success=${success} records zero points, stays unsolved, and leaves both ratings untouched`, async () => {
        const response = await submit({ puzzleId: 'puzzle', success, hintUsed: true });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { oldRating: 1500, newRating: 1500, change: 0 });
        assert.deepEqual(writes.map(write => write.table), ['puzzleAttempt', 'userTagStats']);
        assert.deepEqual(writes[0].data, { userId: 'student', puzzleId: 'puzzle', success: false, points: 0 });
        assert.equal(writes[1].update.unsolvedCount.increment, 1);
        assert.equal(writes[1].create.unsolvedCount, 1);
    });
}

for (const success of [false, true]) {
    test(`ordinary success=${success} keeps existing rating behavior`, async () => {
        const response = await submit({ puzzleId: 'puzzle', success });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert(success ? result.change > 0 : result.change < 0);
        assert.deepEqual(writes.map(write => write.table), ['user', 'puzzle', 'puzzleAttempt', 'userTagStats']);
        assert.equal(writes[2].data.success, success);
        assert.equal(writes[2].data.points, result.change);
        assert.equal(writes[3].update.unsolvedCount.increment, success ? 0 : 1);
    });
}

test('a successful revisit after a hint still earns no points', async () => {
    existingAttempt = { success: false, points: 0 };
    const response = await submit({ puzzleId: 'puzzle', success: true });
    assert.deepEqual(await response.json(), { oldRating: 1500, newRating: 1500, change: 0 });
    assert.deepEqual(writes.map(write => write.table), ['puzzleAttempt', 'userTagStats']);
    assert.equal(writes[0].data.points, 0);
});

test('submission still requires authentication', async () => {
    session = null;
    assert.equal((await submit({ puzzleId: 'puzzle', hintUsed: true })).status, 401);
    assert.deepEqual(writes, []);
});

for (const success of [false, true]) {
    test(`fresh review success=${success} records progress without changing either rating`, async () => {
        const response = await submit({ puzzleId: 'puzzle', success, review: true });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).change, 0);
        assert.deepEqual(writes.map(write => write.table), ['puzzleAttempt', 'userTagStats']);
        assert.equal(writes[0].data.success, success);
        assert.equal(writes[0].data.points, 0);
    });
}
for (const body of [ {puzzleId: 5, success: true}, {puzzleId: 'puzzle', success: 'true'}, {puzzleId: 'puzzle', success: true, review: 'false'}, {puzzleId: 'puzzle', success: true, hintUsed: 'false'} ]) {
    test(`invalid submission ${JSON.stringify(body)} is rejected before database writes`, async () => {
        assert.equal((await submit(body)).status, 400);
        assert.deepEqual(writes, []);
    });
}
