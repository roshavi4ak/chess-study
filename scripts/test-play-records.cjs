/* eslint-disable @typescript-eslint/no-require-imports -- Exercise server aggregation and localized rendering without a database. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextIntlClientProvider } = require('next-intl');

function loadSource(relative, overrides = {}) {
    const filename = path.resolve(__dirname, relative);
    const mod = new Module(filename, module);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
    return mod.exports;
}

const schedule = loadSource('../src/lib/reviewSchedule.ts');
const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
const players = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, lichessId: null }));
players.push({ id: 'hidden', name: 'Hidden', lichessId: 'excluded' });
const grouped = (kind, userId, score) => ({ kind, userId, _max: { score } });
const weekly = (kind, index, score, date = '2026-10-19T12:00:00Z') => ({ kind, user: players[index], score, createdAt: new Date(date) });

function playActions({ mine = [], week = [], allTime = [], fail = false } = {}) {
    return loadSource('../src/app/actions/play.ts', {
        '@/auth': { auth: async () => ({ user: { id: 'p0' } }) },
        '@/lib/db': { prisma: {
            playSession: {
                groupBy: async query => {
                    if (fail) throw new Error('Database unavailable');
                    if (query.where.userId) return mine;
                    // Historical records must have no date restriction and collapse repeat attempts by player.
                    assert.equal(query.where.createdAt, undefined);
                    assert.deepEqual([...query.by].sort(), ['kind', 'userId']);
                    assert.deepEqual(query.where.kind.in, ['STREAK', 'COORDINATES']);
                    return allTime;
                },
                findMany: async () => week,
            },
            user: { findMany: async query => players.filter(player => query.where.id.in.includes(player.id)) },
        } },
        '@/lib/puzzleLadder': {},
        '@/lib/puzzleQueries': {},
        '@/lib/reviewSchedule': { ...schedule, weekDays: () => days },
        '@/lib/leaderboardExclusions': { getExcludedLichessIds: async () => ['excluded'] },
    });
}

test('all-time top five includes historical players, separates games, and honors exclusions', async () => {
    const actions = playActions({
        mine: [grouped('STREAK', 'p0', 12), { kind: 'MINIGAME', key: 'rook', _max: { score: 3 } }],
        week: [weekly('STREAK', 0, 5), weekly('STREAK', 0, 7), weekly('STREAK', 7, 500)],
        allTime: [
            ...players.slice(0, 7).map((player, i) => grouped('STREAK', player.id, i * 10)),
            grouped('STREAK', 'hidden', 500),
            grouped('COORDINATES', 'p0', 44),
            grouped('COORDINATES', 'p1', 0),
        ],
    });
    const result = await actions.getPersonalBests();
    assert.deepEqual(result.clubAllTime.streak, [6, 5, 4, 3, 2].map(i => ({ name: `Player ${i}`, score: i * 10 })));
    assert.deepEqual(result.clubAllTime.coordinates, [{ name: 'Player 0', score: 44 }]);
    assert.deepEqual(result.clubWeek.streak, [{ name: 'Player 0', score: 7 }]);
    assert.deepEqual(result.clubWeek.coordinates, []);
    assert.equal(result.streak, 12);
    assert.deepEqual(result.byKey, { rook: 3 });
});

test('weekly ranking respects Sofia week boundaries while all-time ranking keeps older records', async () => {
    const actions = playActions({
        week: [
            weekly('COORDINATES', 0, 90, '2026-10-18T20:30:00Z'), // Sunday in Sofia.
            weekly('COORDINATES', 1, 20, '2026-10-18T21:30:00Z'), // Monday in Sofia.
            weekly('COORDINATES', 2, 80, '2026-10-25T22:30:00Z'), // Following Monday after DST ends.
        ],
        allTime: [grouped('COORDINATES', 'p0', 90), grouped('COORDINATES', 'p1', 20), grouped('COORDINATES', 'p2', 80)],
    });
    const result = await actions.getPersonalBests();
    assert.deepEqual(result.clubWeek.coordinates, [{ name: 'Player 1', score: 20 }]);
    assert.deepEqual(result.clubAllTime.coordinates.map(row => row.score), [90, 80, 20]);
});

test('empty history returns empty weekly and all-time records', async () => {
    const result = await playActions().getPersonalBests();
    assert.deepEqual(result.clubWeek, { streak: [], coordinates: [] });
    assert.deepEqual(result.clubAllTime, { streak: [], coordinates: [] });
});

const PersonalBestPanel = loadSource('../src/components/PersonalBestPanel.tsx').default;
for (const locale of ['bg', 'en']) {
    const messages = require(`../messages/${locale}.json`);
    const render = props => renderToStaticMarkup(React.createElement(NextIntlClientProvider, {
        locale, messages, timeZone: 'Europe/Sofia',
    }, React.createElement(PersonalBestPanel, props)));

    test(`${locale}: weekly and all-time records are visible together`, () => {
        const html = render({ best: 42, club: [{ name: 'Weekly winner', score: 12 }], allTime: [{ name: 'Historic winner', score: 42 }] });
        assert(html.includes(messages.Fun.clubThisWeek));
        assert(html.includes(messages.Fun.clubAllTime));
        assert(html.includes('Weekly winner'));
        assert(html.includes('Historic winner'));
        assert.equal((html.match(/<ol /g) || []).length, 2);
    });

    test(`${locale}: an empty week still shows historical records and each period has its own empty message`, () => {
        const html = render({ best: 42, club: [], allTime: [{ name: 'Historic winner', score: 42 }] });
        assert(html.includes(messages.Fun.clubEmpty));
        assert(html.includes('Historic winner'));
        assert(!html.includes(messages.Fun.clubAllTimeEmpty));
        assert(render({ best: 0, club: [], allTime: [] }).includes(messages.Fun.clubAllTimeEmpty));
    });
}
