/* eslint-disable @typescript-eslint/no-require-imports -- These .cjs tools use Node's CommonJS runtime. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { extractLiteral, assertBulgarian, writeJson } = require('./prepare-bulgarian-openings.cjs');
const { positionNote } = require('./bulgarian-position-notes.cjs');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'openings/bulgarian/next20');
const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'catalog.json'), 'utf8'));
const overrides = JSON.parse(fs.readFileSync(path.join(directory, 'coach-overrides.json'), 'utf8'));
const reviewedEndings = JSON.parse(fs.readFileSync(path.join(directory, '../endpoint-notes.json'), 'utf8'));
assert.equal(catalog.length, 20);
const summary = [];
for (const item of catalog) {
  const original = fs.readFileSync(path.join(root, 'openings', item.source), 'utf8');
  const data = extractLiteral(original);
  const opening = data.opening;
  const originalNotes = { ...opening.descriptions };
  const originalShortNotes = { ...(opening.shortDescriptions || {}) };
  const color = opening.playerSide;
  const sourceLines = opening.lines.map((pgn, index) => {
    const game = new Chess();
    game.loadPgn(pgn);
    return { pgn, sourceLine: index + 1, history: game.history({ verbose: true }) };
  });
  // A prefix is still taught by the longer line. Do not number the internal node.
  const lines = sourceLines.filter((line, index) => !sourceLines.some((candidate, otherIndex) => otherIndex !== index
    && (candidate.history.length > line.history.length || candidate.history.length === line.history.length && otherIndex < index)
    && line.history.every((move, step) => candidate.history[step]?.lan === move.lan)));
  const removed = sourceLines.filter(line => !lines.includes(line)).map(line => ({ sourceLine: line.sourceLine, pgn: line.pgn, reason: 'Prefix of a retained longer line; its positions and notes remain in the tree.' }));
  const continuations = new Map();
  const endpointFens = new Set();
  for (const line of lines) {
    endpointFens.add(line.history.at(-1).after);
    for (const move of line.history) {
      if (!continuations.has(move.before)) continuations.set(move.before, []);
      if (!continuations.get(move.before).some(candidate => candidate.lan === move.lan)) continuations.get(move.before).push(move);
    }
  }
  const notes = { source: item.source, name: item.name, description: '', rootNote: item.introduction, shortDescriptions: [], lineNames: [], descriptions: {} };
  const evidence = {};
  const describe = (fen, text) => {
    if (!endpointFens.has(fen)) return positionNote(fen, continuations, color, text);
    const reviewed = reviewedEndings[item.name]?.[fen];
    assert(reviewed, `${item.slug}: terminal position needs a reviewed Bulgarian closing note: ${fen}`);
    return { text: reviewed, evidence: [] };
  };
  opening.descriptions = {};
  opening.shortDescriptions = {};
  Object.entries(originalNotes).forEach(([fen, text], index) => {
    const result = describe(fen, text);
    notes.descriptions[index] = result.text;
    opening.descriptions[fen] = result.text;
    evidence[fen] = result.evidence;
  });
  Object.entries(originalShortNotes).forEach(([fen, text]) => {
    const result = describe(fen, text);
    notes.shortDescriptions.push(result.text);
    opening.shortDescriptions[fen] = result.text;
    if (!evidence[fen]) evidence[fen] = result.evidence;
  });
  opening.descriptions[new Chess().fen()] = item.introduction;
  for (const override of overrides[item.slug] || []) {
    const matching = sourceLines.flatMap(line => line.history).filter(move => move.color === color
      && move.before.split(' ')[5] * 2 - (move.color === 'w' ? 1 : 0) === override.ply && move.san === override.san);
    assert(matching.length, `${item.slug}: coaching override does not match a source move: ${override.san}`);
    assertBulgarian(override.text, `${item.slug}: curated note`);
    for (const move of matching) opening.descriptions[move.before] = override.text;
  }
  Object.keys(originalNotes).forEach((fen, index) => { notes.descriptions[index] = opening.descriptions[fen]; });
  // Closing notes need the actual line history; never fall back to a material template.
  for (const fen of endpointFens) {
    opening.descriptions[fen] = describe(fen, '').text;
  }
  notes.extraDescriptions = Object.fromEntries(Object.entries(opening.descriptions).filter(([fen]) => !Object.hasOwn(originalNotes, fen)));
  const main = lines[0].history;
  opening.lineNames = {};
  lines.forEach((line, index) => {
    let branch = line.history.find((move, step) => move.lan !== main[step]?.lan);
    if (!branch) branch = line.history.find(move => move.color === color) || line.history[0];
    const turn = branch.before.split(' ')[5];
    const label = `Вариант ${index + 1}: ${turn}${branch.color === 'w' ? '.' : '...'} ${branch.san}`;
    notes.lineNames.push(label);
    opening.lineNames[line.pgn] = label;
  });
  notes.description = `Упражнявайте ${item.name.split(' (')[0]} с ${color === 'w' ? 'белите' : 'черните'} чрез ${lines.length} варианта и треньорски бележки на български. ${item.plan}`;
  opening.lines = lines.map(line => line.pgn);
  opening.displayName = item.name;
  data.localization = { language: 'bg', source: item.source, sourceSha256: crypto.createHash('sha256').update(original.replace(/\r\n/g, '\n')).digest('hex'), noteMethod: 'New Bulgarian coaching notes authored from the legal course moves and board tactics; not literal translations.', sourceLines: sourceLines.length, terminalLines: lines.length, sourceLineNumbers: lines.map(line => line.sourceLine), removedPrefixes: removed };
  for (const [fen, note] of Object.entries(opening.descriptions)) assertBulgarian(note, `${item.slug} ${fen}`);
  for (const note of notes.shortDescriptions) assertBulgarian(note, `${item.slug} short note`);
  for (const label of notes.lineNames) assertBulgarian(label, `${item.slug} line label`);
  assertBulgarian(notes.description, `${item.slug} description`);
  writeJson(path.join(directory, `${item.slug}.notes.json`), notes);
  writeJson(path.join(directory, `${item.slug}-opening.json`), data);
  writeJson(path.join(directory, `${item.slug}.note-evidence.json`), evidence);
  summary.push({ slug: item.slug, name: item.name, source: item.source, playerColor: color === 'w' ? 'WHITE' : 'BLACK', sourceLines: sourceLines.length, lines: lines.length, sourceNotes: Object.keys(originalNotes).length, removedPrefixes: removed });
  console.log(`${item.slug}: ${lines.length} terminal lines, ${Object.keys(opening.descriptions).length} Bulgarian position notes`);
}
writeJson(path.join(directory, 'preparation.json'), { formatVersion: 1, language: 'bg', status: 'PREPARED_LOCALLY', practices: summary });
