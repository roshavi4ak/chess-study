/* eslint-disable @typescript-eslint/no-require-imports -- Static source extraction and audit tool. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { extractLiteral, writeJson } = require('./prepare-bulgarian-openings.cjs');
const root = path.resolve(__dirname, '..');
const initial = JSON.parse(fs.readFileSync(path.join(root, 'backups/opening-notes-before-2026-10-08.json'), 'utf8'));
const entries = JSON.parse(fs.readFileSync(path.join(root, 'openings/bulgarian/next20/catalog.json'), 'utf8'));
for (const slug of ['caro-kann', 'scotch-game', 'jobava-london', 'london', 'fried-liver-attack', 'sicilian-defense']) {
  const data = JSON.parse(fs.readFileSync(path.join(root, `openings/bulgarian/${slug}.notes.json`), 'utf8'));
  entries.push({ slug, source: data.source, name: data.name });
}
const originalCourses = initial.practices.slice(0, 3);
entries.push({ slug: 'italian-game', source: 'italian game.js', name: originalCourses.find(p => p.name.includes('Italian')).name });
entries.push({ slug: 'vienna-gambit-original', source: 'vienna gambit mastery.js', name: originalCourses.find(p => p.name.includes('Vienna')).name });
entries.push({ slug: 'stafford-gambit-original', source: null, name: originalCourses.find(p => p.name.includes('Stafford')).name });
const result = [], missing = [];
for (const entry of entries) {
  const practice = initial.practices.find(p => p.name === entry.name); assert(practice, entry.name);
  const byId = new Map(practice.nodes.map(n => [n.id, n]));
  const parents = new Set(practice.nodes.map(n => n.parentId));
  const source = entry.source ? extractLiteral(fs.readFileSync(path.join(root, 'openings', entry.source), 'utf8')).opening : null;
  const positionKey = fen => fen.split(' ').slice(0, 4).join(' ');
  const sourceLines = source?.lines.map(pgn => { const g = new Chess(); g.loadPgn(pgn); return { pgn, fen: g.fen(), path: g.history({ verbose: true }).map(m => m.lan).join(' ') }; }) || [];
  const course = { ...entry, practiceId: practice.id, lines: [] };
  for (const node of practice.nodes.filter(n => !parents.has(n.id)).sort((a, b) => a.lineNumber - b.lineNumber)) {
    const chain = []; let current = node;
    while (current.parentId) { chain.unshift(current); current = byId.get(current.parentId); assert(current); }
    const game = new Chess(current.fen);
    chain.forEach(n => { game.move({ from: n.move.slice(0, 2), to: n.move.slice(2, 4), promotion: n.move[4] }); assert.equal(game.fen(), n.fen); });
    const history = game.history({ verbose: true });
    const sourceLine = sourceLines.find(line => line.path === history.map(m => m.lan).join(' '));
    const exact = source?.descriptions?.[node.fen] || source?.shortDescriptions?.[node.fen];
    const alternatives = Object.entries({ ...(source?.shortDescriptions || {}), ...(source?.descriptions || {}) })
      .filter(([fen]) => positionKey(fen) === positionKey(node.fen));
    const texts = [...new Set(alternatives.map(([, text]) => text).filter(Boolean))];
    assert(texts.length < 2 || exact, `${entry.slug}: ambiguous source note at ${node.fen}`);
    let text = exact || texts[0] || null;
    let method = exact ? 'source-exact-fen' : text ? 'source-board-match' : 'no-source-note';
    let language = 'en';
    // Use the original stored Bulgarian note only when no downloaded commentary is available.
    if (!text && ['italian-game', 'vienna-gambit-original', 'stafford-gambit-original'].includes(entry.slug) && node.notes?.trim()) {
      text = node.notes.trim(); language = 'bg'; method = 'original-live-bulgarian-backup';
    }
    const line = { nodeId: node.id, lineNumber: node.lineNumber, fen: node.fen, move: node.move, path: history.map(m => m.lan), pgn: history.map(m => `${m.color === 'w' ? m.before.split(' ')[5] + '.' : ''}${m.san}`).join(' '), sourcePgn: sourceLine?.pgn || null, sourceText: text, language, method, sourceLabel: sourceLine ? source.lineNames?.[sourceLine.pgn] || null : null };
    course.lines.push(line);
    if (!text) missing.push({ slug: entry.slug, line: node.lineNumber, pgn: line.pgn, sourceLabel: line.sourceLabel });
  }
  result.push(course);
}
assert.equal(result.reduce((sum, p) => sum + p.lines.length, 0), 694);
writeJson(path.join(root, 'openings/bulgarian/original-closing-notes-source.json'), { formatVersion: 1, courses: result });
writeJson(path.join(root, 'openings/bulgarian/original-bulgarian-closing-notes.json'), {
  formatVersion: 1,
  source: 'Original live Bulgarian notes captured before the 8 October 2026 repairs.',
  notes: result.flatMap(course => course.lines.filter(line => line.language === 'bg').map(line => ({
    practiceId: course.practiceId, nodeId: line.nodeId, fen: line.fen, notes: line.sourceText,
  }))),
});
const unique = [];
for (const course of result) for (const line of course.lines) {
  if (line.language !== 'en') continue;
  let item = unique.find(item => item.text === line.sourceText);
  if (!item) { item = { id: String(unique.length + 1), text: line.sourceText, uses: [] }; unique.push(item); }
  item.uses.push(`${course.slug}:${line.lineNumber}`);
}
writeJson(path.join(root, 'openings/bulgarian/original-closing-texts.json'), unique);
const counts = result.map(p => ({ slug: p.slug, lines: p.lines.length, english: p.lines.filter(n => n.language === 'en' && n.sourceText).length, bulgarian: p.lines.filter(n => n.language === 'bg' && n.sourceText).length, missing: p.lines.filter(n => !n.sourceText).length }));
console.log(JSON.stringify({ courses: counts, missing, englishTextsToTranslate: unique.length, uniqueEnglishWords: unique.reduce((sum, n) => sum + n.text.split(/\s+/).length, 0) }, null, 2));
