/* eslint-disable @typescript-eslint/no-require-imports -- Regression tests run directly with Node. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Chess } = require('chess.js');
const source = path.resolve(__dirname, '../src/lib/practiceHints.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const moduleUnderTest = new Module(source, module);
moduleUnderTest.paths = Module._nodeModulePaths(path.dirname(source));
moduleUnderTest._compile(compiled, source);
const { getPracticeHint, formatPracticeHint } = moduleUnderTest.exports;
const instruction = moves => `Изиграйте ${moves}.`;
const snapshot = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backups/opening-notes-before-2026-10-08.json'), 'utf8'));
let tested = 0, terminalParents = 0;
for (const practice of snapshot.practices) {
  const children = new Map();
  practice.nodes.forEach(node => { if (!children.has(node.parentId)) children.set(node.parentId, []); children.get(node.parentId).push(node); });
  for (const node of practice.nodes) {
    const input = { ...node, children: children.get(node.id) || [] };
    const hint = formatPracticeHint(input, instruction);
    if (!input.children.length) { assert.equal(hint, '', 'No next move may be requested at an endpoint'); continue; }
    const legalSan = new Chess(node.fen).moves();
    const result = getPracticeHint(input);
    assert(result.moves.length);
    for (const san of result.moves) { assert(legalSan.includes(san)); assert(hint.includes(san)); }
    if (input.children.some(child => !children.has(child.id))) terminalParents++;
    tested++;
  }
}
// Exact screenshot: black knight d6 must take the bishop c4.
const traxler = snapshot.practices.find(p => p.name.includes('Traxler'));
const leaf = traxler.nodes.find(n => n.lineNumber === 9);
const parent = traxler.nodes.find(n => n.id === leaf.parentId);
assert.equal(leaf.move, 'd6c4');
const screenshot = formatPracticeHint({ ...parent, children: [leaf] }, instruction);
assert(screenshot.includes('Nxc4'));
assert(!screenshot.includes(leaf.notes), 'Never use a child closing note as a current-position hint');
assert.equal(formatPracticeHint({ ...parent, notes: null, children: [leaf] }, instruction), 'Изиграйте Nxc4.');
assert.equal(formatPracticeHint({ ...parent, notes: null, children: [{ ...leaf, fen: parent.fen }] }, instruction), '');
// Every permitted branch remains visible even with an incomplete existing note.
const game = new Chess(), branches = ['e4', 'd4'].map(san => { const board = new Chess(); const move = board.move(san); return { move: move.lan, fen: board.fen() }; });
assert.equal(formatPracticeHint({ fen: game.fen(), notes: 'Играйте e4.', children: branches }, instruction), 'Изиграйте e4 / d4.\n\nИграйте e4.');
// Underpromotion must be described as saved, rather than silently changed into a queen.
const promotion = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1'); const before = promotion.fen();
const move = promotion.move({ from: 'a7', to: 'a8', promotion: 'n' });
assert.deepEqual(getPracticeHint({ fen: before, notes: null, children: [{ move: 'a7a8n', fen: promotion.fen() }] }).moves, [move.san]);
console.log(JSON.stringify({ practices: snapshot.practices.length, positionsTested: tested, terminalParents, screenshot: 'Nxc4', underpromotion: 'passed', invalidSavedChild: 'rejected' }));
