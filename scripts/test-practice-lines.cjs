/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Chess } = require('chess.js');

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
const { getAllLeafNodes, hasSeenLine, pickNextLine, getAvailableChildren, chooseOpponentChild } = loadSource('../src/lib/practiceLines.ts');
const { getLichessAnalysisUrl } = loadSource('../src/lib/lichessAnalysis.ts');

function node(id, children = [], lineNumber = null) {
    return { id, children, lineNumber, fen: new Chess().fen(), notes: null, move: null };
}
const seenA = node('seenA', [], 2), seenB = node('seenB', [], 3);
const unseenA = node('unseenA', [], 4), unseenB = node('unseenB', [], 1);
const sharedBranch = node('shared', [seenA, unseenA]);
const unseenBranch = node('new', [unseenB]);
const seenBranch = node('familiar', [seenB]);
const root = node('root', [sharedBranch, unseenBranch, seenBranch]);
const leaves = getAllLeafNodes(root);
const seenIds = new Set(['seenA', 'seenB']);

// Today is 2026-10-17 in Sofia; each run is a minute after the previous one.
const now = new Date('2026-10-17T18:00:00+03:00');
let clock = 0;
const run = (nodeId, status, day = '2026-10-17') => ({ nodeId, status, createdAt: new Date(Date.parse(`${day}T12:00:00+03:00`) + clock++ * 60_000) });
const pick = (attempts, options = {}) => pickNextLine(options.leaves ?? leaves, { seenIds: options.seenIds ?? seenIds, attempts, seenOnly: !!options.seenOnly, now, random: options.random ?? (() => 0) })?.id;
const history = [run('seenA', 'COMPLETED', '2026-10-01'), run('seenB', 'PERFECT', '2026-10-02'), run('seenB', 'PERFECT', '2026-10-05')];

assert.equal(pick(history), 'unseenB', 'New lines come in line-number order');
assert.equal(pick(history, { seenOnly: true }), 'seenA', 'Seen-only mode skips new lines and starts with the most overdue line');
assert.equal(pick([], { seenIds: new Set(), seenOnly: true }), undefined, 'Never fall back to unseen lines');

// A line with mistakes comes back after two other lines, before any new line.
const missed = [...history, run('seenA', 'COMPLETED'), run('unseenB', 'COMPLETED')];
assert.equal(pick(missed), 'unseenA', 'One line later the missed line still waits');
assert.equal(pick([...missed, run('unseenA', 'COMPLETED')]), 'seenA', 'Two lines later the missed line returns first');

// A perfect run on a line that is not mastered yet brings it back after four other lines, ahead of new lines.
const extra = ['x1', 'x2', 'x3', 'x4'].map((id, index) => node(id, [], 10 + index));
const wide = [seenA, ...extra];
const wideSeen = new Set(['seenA']);
const perfectOnce = [run('seenA', 'PERFECT')];
const afterThree = [...perfectOnce, run('x1', 'PERFECT'), run('x2', 'PERFECT'), run('x3', 'PERFECT')];
assert.equal(pick(afterThree, { leaves: wide, seenIds: wideSeen }), 'x4', 'Three lines later the perfect line still waits');
assert.equal(pick([...afterThree, run('x4', 'PERFECT')], { leaves: wide, seenIds: wideSeen }), 'seenA', 'Four lines later the perfect line is shown again on its way to mastery');

// Mastered lines stop coming back the same day.
const mastered = [run('seenA', 'PERFECT', '2026-10-10'), run('seenA', 'PERFECT', '2026-10-12'), run('seenA', 'PERFECT')];
const fourOthers = ['x1', 'x2', 'x3', 'x4'].map(id => run(id, 'PERFECT'));
assert.equal(pick([...mastered, ...fourOthers], { leaves: [...wide, node('x5', [], 20)], seenIds: wideSeen }), 'x5', 'A mastered line is not pushed again today; a new line comes first');

// When every line is waiting, the one played longest ago comes back.
assert.equal(pick([run('seenA', 'PERFECT'), run('seenB', 'PERFECT')], { leaves: [seenA, seenB] }), 'seenA');

// Among lines that are not due, ones still being learned come before mastered ones.
const learningVsMastered = [
    run('seenB', 'PERFECT', '2026-10-01'), run('seenB', 'PERFECT', '2026-10-02'), run('seenB', 'PERFECT', '2026-10-03'), run('seenB', 'PERFECT', '2026-10-16'),
    run('seenA', 'COMPLETED', '2026-10-16'), run('seenA', 'PERFECT', '2026-10-16'),
];
assert.equal(pick(learningVsMastered, { seenOnly: true, random: () => 0.99 }), 'seenA');

assert.deepEqual(getAvailableChildren(root, seenIds).map(child => child.id), ['shared', 'familiar']);
assert.deepEqual(getAvailableChildren(sharedBranch, seenIds).map(child => child.id), ['seenA'], 'Student branches cannot introduce an unseen line');
assert.equal(chooseOpponentChild(root, 'seenB', 'seenA').id, 'familiar', 'Use the newly selected target, including on the first opponent move');
assert.equal(chooseOpponentChild(sharedBranch, 'seenB', 'seenA').id, 'seenA', 'Outside the target branch, follow the preferred line');
assert.equal(chooseOpponentChild(unseenBranch, null, null), undefined);
assert.equal(hasSeenLine({ status: 'NEVER_SEEN', attempts: 0 }), false);
assert.equal(hasSeenLine({ status: 'PARTIAL', attempts: 1 }), true);

const position = new Chess('r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 25');
const url = new URL(getLichessAnalysisUrl(position.fen(), 'black'));
assert.equal(url.origin, 'https://lichess.org');
assert.equal(url.searchParams.get('color'), 'black');
assert.equal(url.pathname.replace('/analysis/standard/', '').replaceAll('_', ' '), position.fen(), 'Preserve turn, castling, en passant, and move clocks');
assert.equal(new URL(getLichessAnalysisUrl(new Chess().fen())).searchParams.get('color'), 'white');
for (const locale of ['en', 'bg']) {
    const messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../messages/${locale}.json`), 'utf8'));
    assert(messages.Common.openLichessAnalysis);
    for (const key of ['previousMove', 'forwardMove', 'reviewingMoves', 'returnToCurrent', 'replayFromHere', 'replayStudentTurn', 'practiceSeenLines', 'noSeenLines', 'seenLinesModeDescription', 'practiceSeenLinesDescription', 'nextSeenLine', 'repeatLine']) assert(messages.Practice[key], `${locale}.${key}`);
}
console.log('Practice line selection, restricted branches, target selection, Lichess FEN, and translations passed.');
