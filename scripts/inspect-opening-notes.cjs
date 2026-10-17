/* eslint-disable @typescript-eslint/no-require-imports -- These .cjs tools use Node's CommonJS runtime. */
// Review source text, Bulgarian text, and the continuations at the annotated position.
const fs = require('node:fs');
const path = require('node:path');
const { Chess } = require('chess.js');
const { extractLiteral } = require('./prepare-bulgarian-openings.cjs');
const slug = process.argv[2];
const first = Number(process.argv[3] || 0);
const last = Number(process.argv[4] || 10000);
let dir = path.resolve(__dirname, '../openings/bulgarian');
if (!fs.existsSync(path.join(dir, `${slug}.notes.json`))) dir = path.join(dir, 'next20');
const translation = JSON.parse(fs.readFileSync(path.join(dir, `${slug}.notes.json`), 'utf8'));
const sourcePath = path.resolve(__dirname, '../openings', translation.source);
const source = extractLiteral(fs.readFileSync(sourcePath, 'utf8')).opening;
const successors = new Map();
for (const pgn of source.lines) {
  const game = new Chess();
  game.loadPgn(pgn);
  for (const move of game.history({ verbose: true })) {
    if (!successors.has(move.before)) successors.set(move.before, new Set());
    successors.get(move.before).add(move.san);
  }
}
Object.entries(source.descriptions).forEach(([fen, note], index) => {
  if (index < first || index > last) return;
  console.log(`${index} [${[...(successors.get(fen) || ['END'])].join(', ')}] EN: ${note}\nBG: ${translation.descriptions[index]}`);
});
