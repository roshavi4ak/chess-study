/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Chess } = require('chess.js');

function loadSource(relativePath) {
    const filename = path.resolve(__dirname, relativePath);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const loaded = new Module(filename, module);
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    loaded._compile(output, filename);
    return loaded.exports;
}
const { getAllLeafNodes, hasSeenLine, getLineCandidates, getAvailableChildren, chooseOpponentChild } = loadSource('../src/lib/practiceLines.ts');
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
const progress = new Map([
    ['seenA', { nodeId: 'seenA', status: 'COMPLETED', attempts: 1, perfectCount: 0 }],
    ['seenB', { nodeId: 'seenB', status: 'PERFECT', attempts: 3, perfectCount: 2 }],
]);
const ids = result => result.lines.map(line => line.id);
assert.deepEqual(ids(getLineCandidates(leaves, progress, new Set(), false)), ['unseenB', 'unseenA']);
assert.deepEqual(ids(getLineCandidates(leaves, progress, new Set(), true)), ['seenA']);
assert.deepEqual(ids(getLineCandidates(leaves, progress, new Set(['seenA']), true)), ['seenB']);
const cycled = getLineCandidates(leaves, progress, new Set(['seenA', 'seenB']), true);
assert(cycled.resetCycle);
assert.deepEqual(ids(cycled), ['seenA'], 'Cycle only familiar lines while unseen lines remain');
assert.deepEqual(ids(getLineCandidates(leaves, new Map(), new Set(), true)), [], 'Never fall back to unseen lines');
assert.deepEqual(getAvailableChildren(root, new Set(progress.keys())).map(child => child.id), ['shared', 'familiar']);
assert.deepEqual(getAvailableChildren(sharedBranch, new Set(progress.keys())).map(child => child.id), ['seenA'], 'Student branches cannot introduce an unseen line');
assert.equal(chooseOpponentChild(root, 'seenB', new Set(progress.keys())).id, 'familiar', 'Use the newly selected target, including on the first opponent move');
assert.equal(chooseOpponentChild(root, 'unseenB', new Set(progress.keys())).id, 'shared', 'Opponent cannot enter an unseen-only branch');
assert.equal(chooseOpponentChild(unseenBranch, 'unseenB', new Set(progress.keys())), undefined);
assert.equal(hasSeenLine({ status: 'NEVER_SEEN', attempts: 0 }), false);
assert.equal(hasSeenLine({ status: 'PARTIAL', attempts: 1 }), true);
progress.set('unseenB', { nodeId: 'unseenB', status: 'COMPLETED', attempts: 1, perfectCount: 0 });
assert(ids(getLineCandidates(leaves, progress, new Set(['seenA', 'seenB']), true)).includes('unseenB'), 'Newly completed lines become available immediately');

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
