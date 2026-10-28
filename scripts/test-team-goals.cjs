/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
// Team challenges and club goals: what each measure counts, Sofia day boundaries, team scores, periods and team splits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

const loaded = new Map();
function loadSource(relative) {
    const file = path.resolve(__dirname, relative);
    if (loaded.has(file)) return loaded.get(file).exports;
    const mod = new Module(file, module);
    loaded.set(file, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    const original = mod.require.bind(mod);
    mod.require = name => name.startsWith('./') ? loadSource(path.relative(__dirname, path.resolve(path.dirname(file), `${name}.ts`))) : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, file);
    return mod.exports;
}
const goals = loadSource('../src/lib/clubGoals.ts');

// Sofia is UTC+3 until 25 October 2026 and UTC+2 after.
const at = (day, time = '12:00', offset = '+03:00') => new Date(`${day}T${time}:00${offset}`);
const week = { startsOn: '2026-10-19', endsOn: '2026-10-25', tag: null, practiceId: null };
const puzzle = (day, success, tags = ['fork'], challengePoints = 10, time) => ({ success, tags, challengePoints, createdAt: at(day, time) });
const line = (day, status, nodeId = 'leaf1', practiceId = 'p1') => ({ practiceId, nodeId, status, createdAt: at(day) });
const play = (day, kind, extra = {}) => ({ kind, key: '', score: 0, won: null, createdAt: at(day), ...extra });
const practices = new Map([['p1', { name: 'Italian', leafIds: ['leaf1', 'leaf2'] }], ['p2', { name: 'Sicilian', leafIds: ['leafA'] }]]);

const activity = {
    puzzleAttempts: [
        puzzle('2026-10-19', true), puzzle('2026-10-20', false, ['fork'], 0), puzzle('2026-10-21', true, ['pin'], 15),
        puzzle('2026-10-18', true, ['fork'], 10, '23:59'), // Sunday before: outside
        puzzle('2026-10-19', true, ['fork'], 5, '00:01'), // first minute of Monday in Sofia: inside
        { success: true, tags: ['fork'], challengePoints: null, createdAt: new Date('2026-10-25T23:30:00+02:00') }, // last Sunday evening after the clock change: inside, legacy null points
    ],
    practiceAttempts: [line('2026-10-20', 'PERFECT'), line('2026-10-21', 'COMPLETED'), line('2026-10-21', 'PARTIAL'), line('2026-10-22', 'PERFECT', 'leafA', 'p2')],
    playSessions: [
        play('2026-10-22', 'BOT_GAME', { won: true }), play('2026-10-22', 'BOT_GAME', { won: false }),
        play('2026-10-23', 'SOLO_CHESS', { score: 1 }), play('2026-10-23', 'SOLO_CHESS', { score: 0 }),
        play('2026-10-23', 'NOTATION', { score: 8 }), play('2026-10-24', 'NOTATION', { score: 6 }),
        play('2026-10-24', 'LEVEL_TEST', { won: true }), play('2026-10-24', 'LEVEL_TEST', { won: false }),
        play('2026-10-24', 'TOURNAMENT'), play('2026-10-26', 'STREAK'),
    ],
};
const value = (metric, extra = {}) => goals.goalValue({ ...week, metric, ...extra }, activity, practices);

test('each measure counts the right activity inside the Sofia week', () => {
    assert.equal(value('PUZZLES_SOLVED'), 4, 'Mon, Wed, Monday 00:01 and Sunday 23:30; not the Sunday before');
    assert.equal(value('PUZZLES_TRIED'), 5);
    assert.equal(value('PUZZLE_POINTS'), 10 + 0 + 15 + 5, 'missing challenge points count as zero');
    assert.equal(value('LINES_PLAYED'), 3, 'perfect and completed runs, not partial ones');
    assert.equal(value('PERFECT_LINES'), 2);
    assert.equal(value('ACTIVE_DAYS'), 7, 'Monday to Sunday all had something');
    assert.equal(value('FUN_GAMES'), 9, 'the Monday after the week is not counted');
    assert.equal(value('BOT_WINS'), 1);
    assert.equal(value('SOLO_SOLVED'), 2, 'every finished solo puzzle, with or without a hint');
    assert.equal(value('NOTATION_CORRECT'), 14);
    assert.equal(value('LEVELS_PASSED'), 1);
    assert.equal(value('TOURNAMENTS'), 1);
    assert.equal(value('MANUAL'), 0, 'only the coach adds manual points');
});

test('a theme narrows puzzle measures and an opening narrows line measures', () => {
    assert.equal(value('PUZZLES_SOLVED', { tag: 'pin' }), 1);
    assert.equal(value('PUZZLE_POINTS', { tag: 'fork' }), 15);
    assert.equal(value('LINES_PLAYED', { practiceId: 'p1' }), 2);
    assert.equal(value('PERFECT_LINES', { practiceId: 'p2' }), 1);
});

test('lines mastered counts only lines that became mastered during the period', () => {
    const history = {
        puzzleAttempts: [], playSessions: [],
        practiceAttempts: [
            // leaf1: perfect on three different days, the third inside the week -> newly mastered.
            line('2026-10-10', 'PERFECT'), line('2026-10-14', 'PERFECT'), line('2026-10-20', 'PERFECT'),
            // leaf2: already mastered before the week -> not counted again.
            line('2026-10-01', 'PERFECT', 'leaf2'), line('2026-10-05', 'PERFECT', 'leaf2'), line('2026-10-09', 'PERFECT', 'leaf2'), line('2026-10-21', 'PERFECT', 'leaf2'),
            // leafA: mastered only after the week ends -> not counted.
            line('2026-10-20', 'PERFECT', 'leafA', 'p2'), line('2026-10-22', 'PERFECT', 'leafA', 'p2'), line('2026-10-27', 'PERFECT', 'leafA', 'p2'),
        ],
    };
    assert.equal(goals.goalValue({ ...week, metric: 'LINES_MASTERED' }, history, practices), 1);
});

test('team scores: totals, averages, hand points, shared places', () => {
    const values = new Map([['a', 10], ['b', 6], ['c', 9], ['d', 0], ['e', 4]]);
    const teams = [
        { id: 'red', name: 'Red', color: 'red', bonus: 0, memberIds: ['a', 'b'] },
        { id: 'blue', name: 'Blue', color: 'blue', bonus: 0, memberIds: ['c', 'd', 'e'] },
        { id: 'green', name: 'Green', color: 'green', bonus: 0, memberIds: [] },
    ];
    const total = goals.teamStandings(teams, values, 'TOTAL');
    assert.deepEqual(total.map(team => [team.id, team.score, team.rank]), [['red', 16, 1], ['blue', 13, 2], ['green', 0, 3]]);
    const average = goals.teamStandings(teams, values, 'AVERAGE');
    assert.deepEqual(average.map(team => [team.id, team.score]), [['red', 8], ['blue', 4.3], ['green', 0]], 'averages round to one decimal; an empty team scores 0');
    const withBonus = goals.teamStandings(teams.map(team => (team.id === 'blue' ? { ...team, bonus: 3 } : team)), values, 'TOTAL');
    assert.deepEqual(withBonus.map(team => [team.id, team.score, team.rank]), [['blue', 16, 1], ['red', 16, 1], ['green', 0, 3]], 'equal scores share first place');
    assert.equal(withBonus.find(team => team.id === 'blue').earned, 13, 'earned excludes hand points');
});

test('club goal progress adds everyone plus hand points and stops at 100%', () => {
    assert.deepEqual(goals.goalProgress(100, [20, 30], 5), { total: 55, percent: 55, reached: false });
    assert.deepEqual(goals.goalProgress(100, [80, 30], 0), { total: 110, percent: 100, reached: true });
    assert.deepEqual(goals.goalProgress(3, [], 0), { total: 0, percent: 0, reached: false });
});

test('periods: presets, phases, days left and date checks', () => {
    assert.deepEqual(goals.presetPeriod('thisWeek', '2026-10-20'), { startsOn: '2026-10-19', endsOn: '2026-10-25' });
    assert.deepEqual(goals.presetPeriod('nextWeek', '2026-10-25'), { startsOn: '2026-10-26', endsOn: '2026-11-01' });
    assert.deepEqual(goals.presetPeriod('thisMonth', '2026-10-20'), { startsOn: '2026-10-01', endsOn: '2026-10-31' });
    assert.deepEqual(goals.presetPeriod('nextMonth', '2026-12-05'), { startsOn: '2027-01-01', endsOn: '2027-01-31' });
    assert.deepEqual(goals.presetPeriod('nextMonth', '2027-01-31'), { startsOn: '2027-02-01', endsOn: '2027-02-28' });
    assert.equal(goals.goalPhase(week, '2026-10-18'), 'upcoming');
    assert.equal(goals.goalPhase(week, '2026-10-19'), 'active');
    assert.equal(goals.goalPhase(week, '2026-10-25'), 'active');
    assert.equal(goals.goalPhase(week, '2026-10-26'), 'finished');
    assert.equal(goals.daysLeft('2026-10-25', '2026-10-25'), 1, 'the last day still counts');
    assert.equal(goals.daysLeft('2026-10-31', '2026-10-20'), 12, 'across the clock change');
    assert(goals.validPeriod('2026-10-19', '2026-10-19'));
    assert(!goals.validPeriod('2026-10-20', '2026-10-19'), 'end before start');
    assert(!goals.validPeriod('2026-02-30', '2026-03-05'), 'no such day');
    assert(!goals.validPeriod('2026-10-32', '2026-11-05'));
    assert(!goals.validPeriod('20.10.2026', '2026-11-05'));
    assert(!goals.validPeriod('2026-01-01', '2027-01-02'), 'longer than a year');
    assert(goals.validPeriod('2026-01-01', '2026-12-31'));
});

test('balanced split deals children out evenly, strongest spread across teams', () => {
    const students = [1800, 1700, 1600, 1500, 1400, 1300, 1200].map((rating, index) => ({ id: `s${index}`, rating }));
    const teams = goals.balancedTeams(students, 2, () => 0.5);
    assert.deepEqual(teams, [['s0', 's3', 's4'], ['s1', 's2', 's5', 's6']]);
    const three = goals.balancedTeams(students, 3);
    assert.deepEqual(three.map(team => team.length).sort(), [2, 2, 3]);
    assert.equal(new Set(three.flat()).size, students.length, 'everyone in exactly one team');
    assert.deepEqual(goals.balancedTeams([], 3), [[], [], []]);
});

test('measure and colour names are checked', () => {
    assert(goals.isGoalMetric('PUZZLES_SOLVED'));
    assert(!goals.isGoalMetric('DROP TABLE'));
    assert(goals.isTeamColor('orange'));
    assert(!goals.isTeamColor('black'));
    assert.equal(goals.GOAL_METRICS.length, 14);
});

test('every automatically counted measure has a contribution destination with its filters intact', () => {
    const expected = {
        PUZZLES_SOLVED: '/puzzles/play?tag=fork', PUZZLES_TRIED: '/puzzles/play?tag=fork', PUZZLE_POINTS: '/puzzles/play?tag=fork',
        LINES_PLAYED: '/practices/p1', PERFECT_LINES: '/practices/p1', LINES_MASTERED: '/practices/p1',
        ACTIVE_DAYS: '/puzzles/play', FUN_GAMES: '/fun', BOT_WINS: '/play/bots', SOLO_SOLVED: '/fun/solo',
        NOTATION_CORRECT: '/fun/notation', LEVELS_PASSED: '/levels', TOURNAMENTS: '/tournaments', MANUAL: null,
    };
    for (const metric of goals.GOAL_METRICS) assert.equal(goals.goalActivityHref({ metric, tag: 'fork', practiceId: 'p1' }), expected[metric], metric);
    assert.equal(goals.goalActivityHref({ metric: 'PUZZLES_SOLVED', tag: null, practiceId: null }), '/puzzles/play');
    assert.equal(goals.goalActivityHref({ metric: 'LINES_PLAYED', tag: null, practiceId: null }), '/practices');
    assert.equal(goals.goalActivityHref({ metric: 'PUZZLES_SOLVED', tag: 'mate & fork', practiceId: null }), '/puzzles/play?tag=mate%20%26%20fork');
});
