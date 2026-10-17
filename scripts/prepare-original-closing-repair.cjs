/* eslint-disable @typescript-eslint/no-require-imports -- Notes-only production patch preparation. */
const path = require('node:path');
const assert = require('node:assert/strict');
const { readJson, writeJson } = require('./prepare-bulgarian-openings.cjs');
const { originalClosingNotes } = require('./prepare-original-closing-notes.cjs');
const root = path.resolve(__dirname, '..');
const filename = process.argv[2];
assert(filename && path.basename(filename) === filename, 'Pass a fresh snapshot filename inside backups');
const snapshot = readJson(path.join(root, 'backups', filename));
const { receipt } = originalClosingNotes();
const repairs = [];
for (const course of receipt.courses) {
  const practice = snapshot.practices.find(p => p.id === course.practiceId);
  assert(practice); assert.equal(practice.name, course.name);
  const byId = new Map(practice.nodes.map(n => [n.id, n]));
  const parentIds = new Set(practice.nodes.map(n => n.parentId));
  assert.equal(practice.nodes.filter(n => !parentIds.has(n.id)).length, course.lines.length);
  for (const line of course.lines) {
    const node = byId.get(line.nodeId); assert(node && !parentIds.has(node.id));
    assert.equal(node.fen, line.fen); assert.equal(node.move, line.move); assert.equal(node.lineNumber, line.lineNumber);
    if (node.notes !== line.notes) repairs.push({ practiceId: practice.id, nodeId: node.id, fen: node.fen, move: node.move, lineNumber: node.lineNumber, expectedNotes: node.notes, notes: line.notes });
    node.notes = line.notes;
  }
}
writeJson(path.join(root, 'backups/opening-original-restore-repairs-2026-10-08.json'), { formatVersion: 1, sourceSnapshot: filename, terminalLinesChecked: 694, repairs });
writeJson(path.join(root, 'backups/opening-original-restore-preview-2026-10-08.json'), snapshot);
console.log(JSON.stringify({ sourceSnapshot: filename, terminalLinesChecked: 694, notesToRestore: repairs.length, practices: receipt.courses.length }));
