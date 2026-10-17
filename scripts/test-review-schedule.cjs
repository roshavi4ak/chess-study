/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const loaded = new Map();
function loadSource(relativePath) {
    const filename = path.resolve(__dirname, relativePath);
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const mod = new Module(filename, module);
    loaded.set(filename, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = mod.require.bind(mod);
    mod.require = name => name.startsWith('./')
        ? loadSource(path.relative(__dirname, path.resolve(path.dirname(filename), `${name}.ts`)))
        : originalRequire(name);
    mod._compile(output, filename);
    return mod.exports;
}

const { sofiaDay, addDays, weekDays, getLineReviewState, isDue, isLineMastered } = loadSource('../src/lib/reviewSchedule.ts');
const { buildDailyMission } = loadSource('../src/lib/dailyMission.ts');

// Sofia days: 21:30 UTC in October is already the next day in Bulgaria (UTC+3).
assert.equal(sofiaDay(new Date('2026-10-12T21:30:00Z')), '2026-10-13');
assert.equal(sofiaDay(new Date('2026-10-12T20:59:00Z')), '2026-10-12');
assert.equal(addDays('2026-10-30', 3), '2026-11-02');
assert.deepEqual(weekDays('2026-10-13'), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
assert.equal(weekDays('2026-10-18')[0], '2026-10-12');

const at = (day, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+03:00`);
const attempt = (status, day, hour) => ({ status, createdAt: at(day, hour) });

assert.equal(getLineReviewState([]), null);
// First run shows notes, so it is COMPLETED: level 0, back tomorrow.
assert.deepEqual(getLineReviewState([attempt('COMPLETED', '2026-10-01')]), { level: 0, lastDay: '2026-10-01', dueDay: '2026-10-02' });
// Several perfect runs on one day count once.
assert.equal(getLineReviewState([
    attempt('COMPLETED', '2026-10-01', 10), attempt('PERFECT', '2026-10-01', 11), attempt('PERFECT', '2026-10-01', 12),
]).level, 1);
// Perfect on three separate days = level 3, next review in 8 days.
const mastered = getLineReviewState([
    attempt('PERFECT', '2026-10-01'), attempt('PERFECT', '2026-10-02'), attempt('PERFECT', '2026-10-04'),
]);
assert.deepEqual(mastered, { level: 3, lastDay: '2026-10-04', dueDay: '2026-10-12' });
assert.equal(isDue(mastered, '2026-10-11'), false);
assert.equal(isDue(mastered, '2026-10-12'), true);
// A slip drops two levels, and a same-day perfect afterwards does not undo it.
assert.equal(getLineReviewState([
    attempt('PERFECT', '2026-10-01'), attempt('PERFECT', '2026-10-02'), attempt('PERFECT', '2026-10-04', 10),
    attempt('COMPLETED', '2026-10-04', 11), attempt('PERFECT', '2026-10-04', 12),
]).level, 1);
// Input order does not matter, PARTIAL attempts are ignored, and the level is capped.
const many = ['01', '02', '03', '04', '05', '06', '07', '08'].map(d => attempt('PERFECT', `2026-10-${d}`)).reverse();
assert.equal(getLineReviewState([...many, attempt('PARTIAL', '2026-10-09')]).level, 5);
assert.equal(getLineReviewState([...many, attempt('PARTIAL', '2026-10-09')]).lastDay, '2026-10-08');

// Mastery: three perfect runs in a row (same day counts), a run with mistakes takes one step back,
// and after 5 runs at least 80% of the last 10 must be perfect. P = PERFECT, M = with mistakes.
const runs = seq => [...seq].map((c, i) => ({ status: c === 'P' ? 'PERFECT' : 'COMPLETED', createdAt: new Date(at('2026-10-01', 9).getTime() + i * 60000) }));
for (const [seq, expected] of [
    ['', false], ['PP', false], ['PPP', true], ['PPM', false], ['PPMP', false], ['PPMPP', true], ['PPPM', false],
    ['PPPPM', true], ['PPPPPM', true], ['PPPPMM', false], ['MMMPPP', false], ['MMPPPPPPPPP', true],
    ['PPPPPPPPPPMM', true], ['PPPPPPPPPPMMM', false],
]) assert.equal(isLineMastered(runs(seq)), expected, seq);
assert.equal(isLineMastered([...runs('PPP'), attempt('PARTIAL', '2026-10-02')]), true);

// Daily mission.
const now = at('2026-10-13', 15);
const practices = new Map([
    ['vienna', { name: 'Vienna', leafIds: ['v1', 'v2', 'v3'] }],
    ['caro', { name: 'Caro-Kann', leafIds: ['c1', 'c2'] }],
]);
const pa = (practiceId, nodeId, status, day, hour) => ({ practiceId, nodeId, status, createdAt: at(day, hour) });
const puzzle = (success, tags, day, hour = 12) => ({ success, tags, createdAt: at(day, hour) });

const mission = buildDailyMission({
    now,
    practices,
    practiceAttempts: [
        pa('vienna', 'v1', 'COMPLETED', '2026-10-12'),      // level 0, due 13th
        pa('vienna', 'v2', 'PERFECT', '2026-10-12'),        // level 1, due 14th: not due
        pa('caro', 'c1', 'COMPLETED', '2026-10-10'),        // level 0, due 11th: overdue
        pa('caro', 'c1', 'PERFECT', '2026-10-13', 9),       // played today: done, still listed
        pa('vienna', 'gone', 'COMPLETED', '2026-10-01'),    // no longer a leaf: ignored
    ],
    puzzleAttempts: [
        puzzle(false, ['fork', 'middlegame'], '2026-10-10'),
        puzzle(false, ['fork'], '2026-10-11'),
        puzzle(true, ['fork'], '2026-10-11'),
        puzzle(false, ['pin'], '2026-10-11'),               // too few attempts to count
        puzzle(false, ['middlegame'], '2026-10-11'),
        puzzle(false, ['middlegame'], '2026-10-11'),        // not a skill theme
        puzzle(true, ['fork'], '2026-10-13'),
        puzzle(true, ['pin'], '2026-10-13'),                // wrong theme today
    ],
});
assert.equal(mission.today, '2026-10-13');
assert.deepEqual(mission.review.map(g => [g.practiceId, g.lineIds, g.doneIds]), [
    ['caro', ['c1'], ['c1']],
    ['vienna', ['v1'], []],
]);
assert.equal(mission.reviewTotal, 2);
assert.equal(mission.reviewDone, 1);
assert.equal(mission.newLine, null);
assert.deepEqual(mission.puzzles, { tag: 'fork', target: 3, done: 1 });
// Active: 10th (completion), 11th (4 puzzles), 12th (completions), 13th (completion today).
assert.deepEqual(mission.week.days.filter(d => d.active).map(d => d.day), ['2026-10-12', '2026-10-13']);
assert.equal(mission.week.days.length, 7);
assert.equal(mission.complete, false);

// Nothing due: suggest a new line in the most recently practised opening that still has unseen lines.
const quiet = buildDailyMission({
    now,
    practices,
    practiceAttempts: [
        pa('caro', 'c1', 'PERFECT', '2026-10-11'), pa('caro', 'c2', 'PERFECT', '2026-10-11'),
        pa('caro', 'c1', 'PERFECT', '2026-10-12'), pa('caro', 'c2', 'PERFECT', '2026-10-12', 13),
        pa('vienna', 'v1', 'PERFECT', '2026-10-09'), pa('vienna', 'v1', 'PERFECT', '2026-10-10'),
        pa('vienna', 'v1', 'PERFECT', '2026-10-11', 11),
    ],
    puzzleAttempts: [],
});
assert.equal(quiet.reviewTotal, 0);
assert.deepEqual(quiet.newLine, { practiceId: 'vienna', practiceName: 'Vienna', done: false });
assert.deepEqual(quiet.puzzles, { tag: null, target: 3, done: 0 });

// Learning the new line today completes that task without moving it to another opening.
const learned = buildDailyMission({
    now,
    practices,
    practiceAttempts: [
        pa('vienna', 'v1', 'PERFECT', '2026-10-09'), pa('vienna', 'v1', 'PERFECT', '2026-10-10'),
        pa('vienna', 'v1', 'PERFECT', '2026-10-11'),
        pa('vienna', 'v2', 'COMPLETED', '2026-10-13', 9), pa('vienna', 'v3', 'COMPLETED', '2026-10-13', 10),
    ],
    puzzleAttempts: [puzzle(true, ['fork'], '2026-10-13'), puzzle(false, ['pin'], '2026-10-13'), puzzle(true, ['mate'], '2026-10-13')],
});
assert.deepEqual(learned.newLine, { practiceId: 'vienna', practiceName: 'Vienna', done: true });
assert.equal(learned.puzzles.done, 3);
assert.equal(learned.complete, true);

// A brand-new student has an empty mission apart from puzzles.
const fresh = buildDailyMission({ now, practices, practiceAttempts: [], puzzleAttempts: [] });
assert.equal(fresh.hasPracticed, false);
assert.equal(fresh.reviewTotal, 0);
assert.equal(fresh.newLine, null);

// The review list is capped at five lines, lowest level first.
const crowded = buildDailyMission({
    now,
    practices: new Map([['big', { name: 'Big', leafIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }]]),
    practiceAttempts: [
        ...['a', 'b', 'c', 'd', 'e', 'f'].map(id => pa('big', id, 'COMPLETED', '2026-10-12')),
        pa('big', 'g', 'PERFECT', '2026-10-11'), // level 1, due today, but ranks after the level-0 lines
    ],
    puzzleAttempts: [],
});
assert.equal(crowded.reviewTotal, 5);
assert.equal(crowded.dueCount, 7);
assert.ok(!crowded.review[0].lineIds.includes('g'));

// Coach homework: only work after the homework was set counts, and each line counts once.
const { getAssignmentProgress, isVisibleToStudent } = loadSource('../src/lib/assignments.ts');
const homework = {
    id: 'h1', kind: 'PRACTICE', studentId: 's1', practiceId: 'vienna', practiceName: 'Vienna', tag: null,
    target: 3, note: null, dueOn: '2026-10-15', createdAt: at('2026-10-12', 10),
};
const homeworkAttempts = [
    pa('vienna', 'v1', 'COMPLETED', '2026-10-11'),
    pa('vienna', 'v1', 'PERFECT', '2026-10-12', 12),
    pa('vienna', 'v1', 'PERFECT', '2026-10-13'),
    pa('vienna', 'v2', 'COMPLETED', '2026-10-13'),
    pa('vienna', 'v3', 'PARTIAL', '2026-10-13'),
    pa('caro', 'c1', 'PERFECT', '2026-10-13'),
];
assert.deepEqual(
    (({ done, complete, overdue }) => ({ done, complete, overdue }))(getAssignmentProgress(homework, homeworkAttempts, [], '2026-10-13')),
    { done: 2, complete: false, overdue: false },
);
assert.equal(getAssignmentProgress(homework, homeworkAttempts, [], '2026-10-16').overdue, true);
const themeHomework = { ...homework, id: 'h2', kind: 'PUZZLE_THEME', practiceId: null, tag: 'fork', target: 2 };
const themeProgress = getAssignmentProgress(themeHomework, [], [
    puzzle(true, ['fork'], '2026-10-11'), puzzle(false, ['fork'], '2026-10-12', 11),
    puzzle(true, ['fork', 'pin'], '2026-10-13'), puzzle(true, ['fork'], '2026-10-13', 14), puzzle(true, ['pin'], '2026-10-13'),
], '2026-10-20');
assert.deepEqual([themeProgress.done, themeProgress.complete, themeProgress.overdue], [2, true, false]);
assert.equal(isVisibleToStudent(homework, '2026-10-15'), true);
assert.equal(isVisibleToStudent(homework, '2026-10-16'), false);

// Coach summary.
const { summarizeStudent } = loadSource('../src/lib/studentSummary.ts');
const summary = summarizeStudent({
    now,
    practices,
    practiceAttempts: [
        ...['05', '06', '07'].map(d => pa('vienna', 'v1', 'PERFECT', `2026-10-${d}`)),  // mastered last week
        ...['09', '11', '12'].map(d => pa('vienna', 'v2', 'PERFECT', `2026-10-${d}`)),  // mastered on Monday
        pa('caro', 'c1', 'COMPLETED', '2026-10-12'),                                     // due today
    ],
    puzzleAttempts: [],
});
assert.deepEqual(summary, {
    backlog: 1, weakTheme: null, activeDaysThisWeek: 1, lastActiveDay: '2026-10-12', mastered: 2, masteredThisWeek: 1, flags: [],
});
const idle = summarizeStudent({ now, practices, practiceAttempts: [pa('caro', 'c1', 'COMPLETED', '2026-10-08')], puzzleAttempts: [] });
assert.deepEqual(idle.flags, ['inactive']);
assert.deepEqual(summarizeStudent({ now, practices, practiceAttempts: [], puzzleAttempts: [] }).lastActiveDay, null);

// Mastery cards.
const { practiceCards, themeCards, sortCards, earnedKeys } = loadSource('../src/lib/masteryCards.ts');
const perfectOn = (practiceId, nodeId, days) => days.map(d => pa(practiceId, nodeId, 'PERFECT', `2026-10-${d}`));
const cardPractices = new Map([
    ['vienna', { name: 'Vienna', leafIds: ['v1', 'v2', 'v3', 'v4', 'v5'] }],
    ['caro', { name: 'Caro-Kann', leafIds: ['c1', 'c2'] }],
    ['fried', { name: 'Fried Liver', leafIds: ['f1'] }],
]);
const byId = cards => Object.fromEntries(cards.map(card => [card.id, [card.tier, card.current, card.nextTarget]]));
assert.deepEqual(byId(practiceCards([
    // Vienna: targets 3 / 4 / 5 lines; 3 mastered = bronze.
    ...perfectOn('vienna', 'v1', ['01', '02', '03']),
    ...perfectOn('vienna', 'v2', ['01', '02', '03']),
    ...perfectOn('vienna', 'v3', ['01', '01', '01']),  // three in a row on one day also counts
    ...perfectOn('vienna', 'v4', ['01', '02']), pa('vienna', 'v4', 'COMPLETED', '2026-10-03'),  // slipped on the third run
    // Caro-Kann: started, nothing mastered yet.
    pa('caro', 'c1', 'COMPLETED', '2026-10-01'),
    // Fried Liver: single line, mastered = straight to gold.
    ...perfectOn('fried', 'f1', ['05', '06', '07']),
], cardPractices)), {
    'practice:vienna': ['bronze', 3, 4],
    'practice:caro': [null, 0, 1],
    'practice:fried': ['gold', 1, null],
});

const themes = byId(themeCards([
    ...['01', '02', '03', '04', '05'].map(d => puzzle(true, ['fork', 'middlegame'], `2026-10-${d}`)),
    puzzle(true, ['fork'], '2026-10-05', 18),                          // same day again: no extra credit
    ...['01', '02'].map(d => puzzle(true, ['pin'], `2026-10-${d}`)),
]));
assert.deepEqual(themes, { 'theme:fork': ['silver', 5, 10], 'theme:pin': [null, 2, 3] });

const sorted = sortCards([
    { id: 'a', name: 'A', tier: null, current: 2, nextTarget: 3 },
    { id: 'b', name: 'B', tier: 'gold', current: 1, nextTarget: null },
    { id: 'c', name: 'C', tier: null, current: 0, nextTarget: 3 },
    { id: 'd', name: 'D', tier: 'bronze', current: 3, nextTarget: 4 },
]);
assert.deepEqual(sorted.map(card => card.id), ['b', 'd', 'a', 'c']);
assert.deepEqual(earnedKeys([{ id: 'theme:fork', tier: 'silver' }, { id: 'theme:pin', tier: null }]), ['theme:fork:bronze', 'theme:fork:silver']);

// Weekly effort board: 10 per active day, 5 per line mastered this week, 1 per puzzle tried (max 50).
const { weeklyEffort } = loadSource('../src/lib/effortBoard.ts');
const effort = weeklyEffort({
    now,
    practices,
    practiceAttempts: [
        ...['09', '11', '12'].map(d => pa('vienna', 'v2', 'PERFECT', `2026-10-${d}`)),  // mastered on Monday
    ],
    puzzleAttempts: [
        { ...puzzle(true, ['fork'], '2026-10-11'), points: 40 },                         // last week: ignored
        { ...puzzle(true, ['fork'], '2026-10-13'), points: 12 },
        { ...puzzle(false, ['fork'], '2026-10-13', 13), points: -7 },
        { ...puzzle(true, ['pin'], '2026-10-13', 14), points: 0 },
    ],
});
// Active: Monday (line) and Tuesday (3 puzzles).
assert.deepEqual(effort, { activeDays: 2, masteredThisWeek: 1, puzzlesTried: 3, playSessions: 0, ratingChange: 5, effortPoints: 28, reachedGoal: false });
const grinder = weeklyEffort({
    now, practices, practiceAttempts: [],
    puzzleAttempts: Array.from({ length: 80 }, (_, index) => puzzle(true, ['fork'], '2026-10-13', 9 + (index % 10))),
});
assert.equal(grinder.effortPoints, 10 + 50);
const regular = weeklyEffort({ // Friday evening: four active days
    now: at('2026-10-16', 20), practices, practiceAttempts: ['12', '13'].map(d => pa('caro', 'c1', 'COMPLETED', `2026-10-${d}`)),
    puzzleAttempts: [...Array.from({ length: 3 }, () => puzzle(true, ['pin'], '2026-10-14')), ...Array.from({ length: 3 }, () => puzzle(true, ['pin'], '2026-10-15'))],
});
assert.equal(regular.reachedGoal, true);

console.log('Review schedule, daily mission, homework, coach summary, mastery card and effort board checks passed.');
