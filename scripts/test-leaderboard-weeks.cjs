/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadSource(relativePath, overrides = {}) {
    const filename = path.resolve(__dirname, relativePath);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const loaded = new Module(filename, module);
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = name => overrides[name] || originalRequire(name);
    loaded._compile(output, filename);
    return loaded.exports;
}

const weekModule = loadSource('../src/lib/leaderboardWeeks.ts');
const { getLeaderboardWeek } = weekModule;
const cases = [
    ['2026-10-13T04:00:00Z', '05.10.2026', '11.10.2026', '2026-10-04T21:00:00.000Z', '2026-10-11T21:00:00.000Z'],
    // Sunday evening UTC is already Monday in Bulgaria.
    ['2026-10-11T20:59:59.999Z', '28.09.2026', '04.10.2026', '2026-09-27T21:00:00.000Z', '2026-10-04T21:00:00.000Z'],
    ['2026-10-11T21:00:00Z', '05.10.2026', '11.10.2026', '2026-10-04T21:00:00.000Z', '2026-10-11T21:00:00.000Z'],
    ['2026-10-19T00:00:00+03:00', '12.10.2026', '18.10.2026', '2026-10-11T21:00:00.000Z', '2026-10-18T21:00:00.000Z'],
    // The spring and autumn clock changes create 167- and 169-hour weeks.
    ['2026-03-30T00:00:00+03:00', '23.03.2026', '29.03.2026', '2026-03-22T22:00:00.000Z', '2026-03-29T21:00:00.000Z'],
    ['2026-10-26T00:00:00+02:00', '19.10.2026', '25.10.2026', '2026-10-18T21:00:00.000Z', '2026-10-25T22:00:00.000Z'],
    ['2026-01-01T12:00:00Z', '22.12.2025', '28.12.2025', '2025-12-21T22:00:00.000Z', '2025-12-28T22:00:00.000Z'],
];

for (const [now, startLabel, endLabel, start, end] of cases) {
    const week = getLeaderboardWeek(new Date(now), 1);
    assert.deepEqual(week.dateRange, { start: startLabel, end: endLabel }, now);
    assert.equal(week.startDate.toISOString(), start, now);
    assert.equal(week.endDate.toISOString(), end, now);
}

// Verify the server queries and returned label use the very same week, and the
// exclusive Monday boundary prevents this week's attempts entering last week.
async function checkStatistics() {
    const queries = [];
    const prisma = {
        puzzleAttempt: { groupBy: async query => { queries.push(query); return []; } },
        practiceLineProgress: { groupBy: async query => { queries.push(query); return []; } },
    };
    const { getWeeklyStatistics } = loadSource('../src/app/actions/statistics.ts', {
        '@/lib/db': { prisma }, '@/lib/leaderboardWeeks': weekModule,
    });
    const RealDate = Date;
    const fixedNow = '2026-10-13T04:00:00Z';
    global.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    };
    let result;
    try { result = await getWeeklyStatistics(); } finally { global.Date = RealDate; }

    assert.deepEqual(result.dateRange, { start: '05.10.2026', end: '11.10.2026' });
    assert.equal(queries.length, 3);
    for (const query of queries) {
        const range = query.where.createdAt || query.where.lastAttemptAt;
        assert.equal(range.gte.toISOString(), '2026-10-04T21:00:00.000Z');
        assert.equal(range.lt.toISOString(), '2026-10-11T21:00:00.000Z');
        assert.equal(query.where.user.role, 'STUDENT');
        if (query.where.lastAttemptAt || query.by.length === 1) assert.equal(query.take, 3);
        else {
            assert.deepEqual(query.by, ['userId', 'success']);
            assert.equal(query._sum.challengePoints, true);
        }
    }
    console.log('Leaderboard week boundaries and statistics query regression checks passed.');
}
checkStatistics().catch(error => { console.error(error); process.exitCode = 1; });
