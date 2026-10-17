/* eslint-disable @typescript-eslint/no-require-imports -- These .cjs tools use Node's CommonJS runtime. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'openings', 'bulgarian');
const slugs = ['caro-kann', 'scotch-game', 'jobava-london', 'london', 'fried-liver-attack', 'sicilian-defense'];
const expectedLines = {
  'caro-kann': 28,
  'scotch-game': 27,
  'jobava-london': 26,
  london: 28,
  'fried-liver-attack': 15,
  'sicilian-defense': 38,
};
const aliases = {
  'caro-kann': ['carokann', 'карокан'],
  'scotch-game': ['scotch', 'шотландска'],
  'jobava-london': ['jobava', 'джобава'],
  london: ['london', 'лондон'],
  'fried-liver-attack': ['fried-liver', 'фрид'],
  'sicilian-defense': ['sicilian', 'сицилианска'],
};
const nextSlugs = ['london', 'fried-liver-attack', 'sicilian-defense'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function assertBulgarian(text, label) {
  assert.equal(typeof text, 'string', `${label}: expected text`);
  assert(/[А-Яа-я]/.test(text), `${label}: missing Bulgarian text`);
  // Retain notation and the two addresses explicitly present in original commentary.
  // These are source content, not instructions to contact anyone.
  const prose = text
    .replace(/\bethan@chessreps\.com\b|\bchess\.com\b/g, '')
    .replace(/\b(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?)\b/g, '')
    .replace(/\b[a-h]-/g, '');
  assert(!/[A-Za-z]{2,}/.test(prose), `${label}: untranslated Latin word`);
}

function extractLiteral(source) {
  const ts = require('typescript');
  const match = source.match(/__sveltekit_\w+\.resolve\(\d+,\s*\(\)\s*=>\s*\[(.*)\]\)/);
  assert(match, 'Complete opening payload not found');
  const parsed = ts.createSourceFile('opening.js', `(${match[1]})`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(parsed.parseDiagnostics.length, 0, 'Invalid payload syntax');
  function literal(node) {
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const property of node.properties) {
        assert(ts.isPropertyAssignment(property), 'Nonliteral opening property');
        assert(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name), 'Computed opening property');
        assert(!Object.hasOwn(result, property.name.text), 'Duplicate opening property');
        result[property.name.text] = literal(property.initializer);
      }
      return result;
    }
    throw new Error(`Nonliteral opening data: ${ts.SyntaxKind[node.kind]}`);
  }
  assert.equal(parsed.statements.length, 1, 'Unexpected payload statements');
  return literal(parsed.statements[0].expression.expression);
}

function prepare(slug) {
  const translation = readJson(path.join(directory, `${slug}.notes.json`));
  const source = fs.readFileSync(path.join(root, 'openings', translation.source), 'utf8');
  const data = extractLiteral(source);
  const opening = data.opening;
  const noteKeys = Object.keys(opening.descriptions || {});
  assert.equal(opening.lines.length, expectedLines[slug]);
  assert.equal(Object.keys(translation.descriptions).length, noteKeys.length, `${slug}: translation count`);
  assert.equal(translation.lineNames.length, opening.lines.length, `${slug}: variation names`);
  const shortDescriptions = opening.shortDescriptions || {};
  assert.equal(translation.shortDescriptions.length, Object.keys(shortDescriptions).length);
  noteKeys.forEach((fen, index) => {
    const note = translation.descriptions[index];
    assertBulgarian(note, `${slug} note ${index}`);
    opening.descriptions[fen] = note;
  });
  Object.keys(shortDescriptions).forEach((fen, index) => {
    const note = translation.shortDescriptions[index];
    assertBulgarian(note, `${slug} short note ${index}`);
    shortDescriptions[fen] = note;
  });
  opening.shortDescriptions = shortDescriptions;
  opening.lines.forEach((pgn, index) => {
    const name = translation.lineNames[index];
    assertBulgarian(name, `${slug} variation ${index + 1}`);
    opening.lineNames[pgn] = name;
  });
  assertBulgarian(translation.rootNote, `${slug} introduction`);
  assertBulgarian(translation.description, `${slug} description`);
  opening.descriptions[new Chess().fen()] = translation.rootNote;
  opening.displayName = translation.name;
  const reviewedEndings = readJson(path.join(directory, 'endpoint-notes.json'))[translation.name];
  assert(reviewedEndings, `${slug}: reviewed terminal notes missing`);
  for (const pgn of opening.lines) {
    const game = new Chess(); game.loadPgn(pgn);
    assert(reviewedEndings[game.fen()], `${slug}: ending needs review: ${game.fen()}`);
    opening.descriptions[game.fen()] = reviewedEndings[game.fen()];
  }
  const sourceHash = crypto.createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
  data.localization = { language: 'bg', source: translation.source, sourceSha256: sourceHash };
  writeJson(path.join(directory, `${slug}-opening.json`), data);
  console.log(`${slug}: prepared ${noteKeys.length} Bulgarian source notes and ${opening.lines.length} variation names`);
}

function validate(slug) {
  const source = readJson(path.join(directory, `${slug}-opening.json`));
  const translation = readJson(path.join(directory, `${slug}.notes.json`));
  const opening = source.opening;
  const tree = readJson(path.join(directory, `${slug}-opening-practice.json`));
  const nodes = [];
  const paths = new Map();
  const ids = new Set();
  const byFen = new Map();
  assert.equal(tree.fen, new Chess().fen());
  assert.equal(tree.move, null);
  function walk(node, moves) {
    assert(!ids.has(node.id), `${slug}: duplicate node ID`);
    ids.add(node.id);
    nodes.push(node);
    paths.set(moves.join(' '), node);
    byFen.set(node.fen, node);
    if (node.notes) assertBulgarian(node.notes, `${slug} position ${node.id}`);
    assert.equal(node.notes, opening.descriptions[node.fen] || opening.shortDescriptions[node.fen] ||
      (node.lineNumber !== null ? translation.lineNames[node.lineNumber - 1] : '') || '', `${slug}: note position changed`);
    if (node.children.length) assert.equal(node.lineNumber, null, `${slug}: numbered nonterminal node`);
    const childMoves = new Set();
    for (const child of node.children) {
      assert(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(child.move), `${slug}: invalid UCI`);
      assert(!childMoves.has(child.move), `${slug}: duplicate sibling move`);
      childMoves.add(child.move);
      const chess = new Chess(node.fen);
      chess.move({ from: child.move.slice(0, 2), to: child.move.slice(2, 4), promotion: child.move[4] });
      assert.equal(chess.fen(), child.fen, `${slug}: FEN mismatch`);
      walk(child, [...moves, child.move]);
    }
  }
  walk(tree, []);
  const leaves = nodes.filter(node => !node.children.length);
  assert.equal(leaves.length, expectedLines[slug], `${slug}: missing terminal variations`);
  assert.deepEqual(leaves.map(node => node.lineNumber).sort((a, b) => a - b), opening.lines.map((_, index) => index + 1));
  opening.lines.forEach((pgn, index) => {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history({ verbose: true }).map(move => move.lan);
    const endpoint = paths.get(moves.join(' '));
    assert(endpoint, `${slug}: missing source variation ${index + 1}`);
    assert.equal(endpoint.lineNumber, index + 1);
    assert.equal(endpoint.fen, game.fen());
  });
  Object.entries(opening.descriptions).forEach(([fen, note]) => {
    assert.equal(byFen.get(fen)?.notes, note, `${slug}: dropped source annotation`);
  });
  const counts = { nodes: nodes.length, lines: leaves.length, notes: nodes.filter(node => node.notes).length };
  console.log(`${slug}: validated ${counts.lines} lines, ${counts.nodes} nodes, ${counts.notes} Bulgarian notes`);
  return { slug, aliases: aliases[slug], name: translation.name, description: translation.description,
    playerColor: opening.playerSide === 'w' ? 'WHITE' : 'BLACK', localization: source.localization, counts, tree };
}

module.exports = { assertBulgarian, extractLiteral, readJson, writeJson };

if (require.main === module) {
const mode = process.argv[2];
if (mode === 'prepare') slugs.forEach(prepare);
else if (mode === 'validate') {
  const practices = slugs.map(validate);
  writeJson(path.join(directory, 'practices.json'), { formatVersion: 1, language: 'bg', coachLichessId: 'roshavi4ak', practices });
  writeJson(path.join(directory, 'next-practices.json'), {
    formatVersion: 1,
    language: 'bg',
    coachLichessId: 'roshavi4ak',
    practices: practices.filter((practice) => nextSlugs.includes(practice.slug)),
  });
} else throw new Error('Usage: node scripts/prepare-bulgarian-openings.cjs prepare|validate');
}
