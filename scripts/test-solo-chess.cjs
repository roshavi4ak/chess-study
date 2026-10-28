/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
// Solo chess rules, the 120 stored puzzles, and the "never repeat a solved puzzle" queue.
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

const solo = loadSource('../src/lib/soloChess.ts');
const puzzles = require('../src/lib/soloChessPuzzles.json');
const moves = (pieces, from) => solo.soloMoves(solo.parsePieces(pieces), from).map(move => `${move.from}${move.to}`).sort();

test('every move is a capture along normal piece moves; sliding pieces are blocked', () => {
    assert.deepEqual(moves(['Ra1', 'Ra5', 'Ra8']), ['a1a5', 'a5a1', 'a5a8', 'a8a5']);
    assert.deepEqual(moves(['Nb1', 'Pc3', 'Pd2']), ['b1c3', 'b1d2', 'd2c3'], 'the d2 pawn takes diagonally forward; c3 attacks nothing');
    assert.deepEqual(moves(['Pe4', 'Pe5', 'Nd5']), ['e4d5'], 'a pawn captures diagonally forward, never straight');
    assert.deepEqual(moves(['Bc1', 'Ne3', 'Rg5']), ['c1e3'], 'the knight on e3 blocks the bishop');
});

test('the king can never be captured, and each piece captures at most twice', () => {
    assert.deepEqual(moves(['Ke1', 'Qe2']), ['e1e2'], 'the queen cannot take the king');
    let position = solo.parsePieces(['Ra1', 'Pa3', 'Pa5', 'Pa7']);
    position = solo.playSoloMove(position, { from: 'a1', to: 'a3' });
    position = solo.playSoloMove(position, { from: 'a3', to: 'a5' });
    assert.equal(position.find(piece => piece.square === 'a5').captures, 2);
    assert.equal(solo.playSoloMove(position, { from: 'a5', to: 'a7' }), null, 'a third capture is not allowed');
    assert(solo.isStuck(position));
    assert.equal(solo.solveSolo(solo.parsePieces(['Ra1', 'Pa3', 'Pa5', 'Pa7'])), null);
});

test('a capture that is not allowed changes nothing', () => {
    const position = solo.parsePieces(['Ra1', 'Nb3']);
    assert.equal(solo.playSoloMove(position, { from: 'a1', to: 'b3' }), null);
    assert.equal(solo.playSoloMove(position, { from: 'a1', to: 'a5' }), null, 'moving to an empty square is not a capture');
});

test('the solver finds a winning order and counts solutions', () => {
    const position = solo.parsePieces(['Qd1', 'Nd4', 'Bf6']);
    const solution = solo.solveSolo(position);
    let current = position;
    for (const move of solution) current = solo.playSoloMove(current, move);
    assert(solo.isSolved(current));
    assert(solo.countSoloSolutions(position) >= 1);
});

test('120 different stored puzzles, 40 per band, all solvable from their starting position', () => {
    assert(puzzles.length >= 100);
    assert.equal(puzzles.length, 120);
    assert.equal(new Set(puzzles.map(p => p.id)).size, puzzles.length, 'ids are unique');
    assert.equal(new Set(puzzles.map(p => [...p.pieces].sort().join(' '))).size, puzzles.length, 'positions are unique');
    for (const band of solo.SOLO_BANDS) assert.equal(puzzles.filter(p => p.band === band).length, 40);
    for (const puzzle of puzzles) {
        const position = solo.parsePieces(puzzle.pieces);
        assert.equal(new Set(puzzle.pieces.map(p => p.slice(1))).size, puzzle.pieces.length, `${puzzle.id}: one piece per square`);
        assert(puzzle.pieces.every(p => /^[KQRBNP][a-h][1-8]$/.test(p)), `${puzzle.id}: piece format`);
        assert(puzzle.pieces.filter(p => p[0] === 'P').every(p => p[2] !== '1' && p[2] !== '8'), `${puzzle.id}: no pawn on the first or last rank`);
        assert(puzzle.pieces.filter(p => p[0] === 'K').length <= 1, `${puzzle.id}: at most one king`);
        assert(solo.solveSolo(position), `${puzzle.id} is solvable`);
        assert.equal(solo.countSoloSolutions(position), puzzle.solutions, `${puzzle.id}: stored solution count`);
    }
    const sizes = band => puzzles.filter(p => p.band === band).map(p => p.pieces.length);
    assert(Math.max(...sizes('easy')) < Math.min(...sizes('medium')), 'medium puzzles have more pieces than easy ones');
    assert(Math.max(...sizes('medium')) < Math.min(...sizes('hard')), 'hard puzzles have more pieces than medium ones');
});

test('a puzzle solved without help never comes back; skipped ones come back last', () => {
    const band = puzzles.filter(p => p.band === 'easy');
    const solved = new Set([band[0].id, band[2].id]);
    assert.equal(solo.nextSoloPuzzle(band, solved).id, band[1].id);
    assert.equal(solo.nextSoloPuzzle(band, solved, [band[1].id], band[1].id).id, band[3].id);
    const allButOne = new Set(band.slice(1).map(p => p.id));
    assert.equal(solo.nextSoloPuzzle(band, allButOne, [band[0].id], band[0].id).id, band[0].id, 'skipping the last unsolved puzzle brings it back');
    assert.equal(solo.nextSoloPuzzle(band, new Set(band.map(p => p.id))), null, 'nothing left once everything is solved');
    // Walking the queue visits every puzzle exactly once.
    const seen = new Set();
    for (let puzzle = solo.nextSoloPuzzle(band, seen); puzzle; puzzle = solo.nextSoloPuzzle(band, seen)) {
        assert(!seen.has(puzzle.id));
        seen.add(puzzle.id);
    }
    assert.equal(seen.size, band.length);
});

test('building puzzles backwards always gives solvable positions', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let built = 0;
    for (let i = 0; i < 200; i++) {
        const pieces = solo.buildSoloPosition(3 + (i % 6), random);
        if (!pieces) continue;
        built += 1;
        assert(solo.solveSolo(pieces), solo.formatPieces(pieces).join(' '));
    }
    assert(built > 150);
});
