/* eslint-disable @typescript-eslint/no-require-imports -- Read-only content and legal-path audit. */
const path = require('node:path');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { readJson } = require('./prepare-bulgarian-openings.cjs');
const { originalClosingNotes } = require('./prepare-original-closing-notes.cjs');
const root = path.resolve(__dirname, '..');
const snapshot = readJson(path.resolve(root, process.argv[2] || 'backups/opening-original-restore-after-2026-10-08.json'));
const { receipt } = originalClosingNotes();
let endings = 0, positionsChecked = 0;
for (const course of receipt.courses) {
  const practice = snapshot.practices.find(p => p.id === course.practiceId); assert(practice, course.name);
  const byId = new Map(practice.nodes.map(n => [n.id, n]));
  const parentIds = new Set(practice.nodes.map(n => n.parentId));
  assert.equal(practice.nodes.filter(n => !parentIds.has(n.id)).length, course.lines.length);
  for (const line of course.lines) {
    const leaf = byId.get(line.nodeId); assert(leaf && !parentIds.has(leaf.id));
    assert.equal(leaf.notes, line.notes, `${course.slug}:${line.lineNumber}: closing note differs from original translation`);
    assert.equal(leaf.fen, line.fen); assert.equal(leaf.lineNumber, line.lineNumber);
    const chain = []; let current = leaf;
    while (current.parentId) { chain.unshift(current); current = byId.get(current.parentId); assert(current); }
    const game = new Chess(current.fen);
    for (const node of chain) {
      game.move({ from: node.move.slice(0, 2), to: node.move.slice(2, 4), promotion: node.move[4] });
      assert.equal(game.fen(), node.fen); positionsChecked++;
    }
    assert.deepEqual(game.history({ verbose: true }).map(m => m.lan), line.path);
    endings++;
  }
}
assert.equal(endings, 694);
console.log(JSON.stringify({ mode: 'READ_ONLY', courses: receipt.courses.length, closingNotesMatched: endings, positionsChecked }));
