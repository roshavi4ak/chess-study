/* eslint-disable @typescript-eslint/no-require-imports -- These .cjs tools use Node's CommonJS runtime. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Chess } = require('chess.js');
const { extractLiteral, assertBulgarian, writeJson } = require('./prepare-bulgarian-openings.cjs');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'openings/bulgarian/next20');
const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'catalog.json'), 'utf8'));
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));

// Independent native move generation confirms attacks mentioned by the authored notes.
function canCapture(game, color, square, target) {
  const fields = game.fen().split(' ');
  fields[1] = color;
  fields[3] = '-';
  return new Chess(fields.join(' ')).moves({ square, verbose: true }).some(move => move.to === target && move.captured);
}

function checkRay(game, origin, front, back) {
  const coordinate = square => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
  const [x, y] = coordinate(origin), [fx, fy] = coordinate(front), [bx, by] = coordinate(back);
  const dx = Math.sign(bx - x), dy = Math.sign(by - y);
  assert(!dx || !dy || Math.abs(bx - x) === Math.abs(by - y), 'Nonlinear pin');
  const occupants = [];
  for (let step = 1; step <= Math.max(Math.abs(bx - x), Math.abs(by - y)); step++) {
    const square = String.fromCharCode(97 + x + dx * step) + (y + dy * step + 1);
    if (game.get(square)) occupants.push(square);
  }
  assert.deepEqual(occupants, [front, back], 'Pin or skewer has another blocking piece');
  assert(fx !== bx || fy !== by);
}

const practices = [];
const report = [];
let claimCount = 0;
for (const item of catalog) {
  const raw = fs.readFileSync(path.join(root, 'openings', item.source), 'utf8');
  const source = extractLiteral(raw).opening;
  const localized = read(`${item.slug}-opening.json`);
  const opening = localized.opening;
  const notes = read(`${item.slug}.notes.json`);
  const evidence = read(`${item.slug}.note-evidence.json`);
  const tree = read(`${item.slug}-opening-practice.json`);
  assert.equal(localized.localization.sourceSha256, crypto.createHash('sha256').update(raw.replace(/\r\n/g, '\n')).digest('hex'));
  assert.equal(opening.playerSide, source.playerSide);
  assert.equal(opening.sharedOpeningPgn, source.sharedOpeningPgn);
  assert.equal(opening.sharedOpeningFen, source.sharedOpeningFen);
  assert.equal(tree.fen, new Chess().fen());
  assert.equal(tree.move, null);
  assert.equal(tree.lineNumber, null);
  const ids = new Set(), positions = new Map(), paths = new Map(), all = [];
  function walk(node, moves) {
    assert(!ids.has(node.id), `${item.slug}: duplicate node ID`);
    ids.add(node.id);
    all.push(node);
    positions.set(node.fen, node);
    paths.set(moves.join(' '), node);
    if (node.notes) assertBulgarian(node.notes, `${item.slug}: coach note`);
    assert.equal(node.notes, opening.descriptions[node.fen] || opening.shortDescriptions[node.fen] || '', `${item.slug}: changed note position`);
    if (node.children.length) assert.equal(node.lineNumber, null, `${item.slug}: internal numbered node`);
    const siblings = new Set();
    for (const child of node.children) {
      assert(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(child.move));
      assert(!siblings.has(child.move), `${item.slug}: duplicated sibling move`);
      siblings.add(child.move);
      const game = new Chess(node.fen);
      game.move({ from: child.move.slice(0, 2), to: child.move.slice(2, 4), promotion: child.move[4] });
      assert.equal(game.fen(), child.fen, `${item.slug}: UCI/FEN mismatch`);
      walk(child, [...moves, child.move]);
    }
  }
  walk(tree, []);
  const leaves = all.filter(node => !node.children.length);
  assert.equal(leaves.length, opening.lines.length);
  assert.deepEqual(leaves.map(node => node.lineNumber).sort((a, b) => a - b), opening.lines.map((_, index) => index + 1));
  source.lines.forEach((pgn, index) => {
    const game = new Chess();
    game.loadPgn(pgn);
    const node = paths.get(game.history({ verbose: true }).map(move => move.lan).join(' '));
    assert(node, `${item.slug}: source path ${index + 1} disappeared`);
    assert.equal(node.fen, game.fen());
  });
  opening.lines.forEach((pgn, index) => {
    assert(source.lines.includes(pgn), `${item.slug}: added or edited source PGN`);
    const game = new Chess();
    game.loadPgn(pgn);
    assert.equal(paths.get(game.history({ verbose: true }).map(move => move.lan).join(' ')).lineNumber, index + 1);
    assertBulgarian(opening.lineNames[pgn], `${item.slug}: variation name`);
  });
  for (const fen of Object.keys(source.descriptions)) {
    assert(positions.has(fen), `${item.slug}: source annotation position missing`);
    assertBulgarian(positions.get(fen).notes, `${item.slug}: source annotation missing`);
  }
  for (const [fen, text] of Object.entries(opening.descriptions)) assert.equal(positions.get(fen)?.notes, text);
  for (const fen of Object.keys(source.shortDescriptions || {})) {
    assert(positions.has(fen), `${item.slug}: short note position missing`);
    assertBulgarian(positions.get(fen).notes, `${item.slug}: short note missing`);
  }
  for (const [fen, examples] of Object.entries(evidence)) {
    for (const example of examples) {
      const game = new Chess(fen);
      const move = game.move(example.san);
      assert.equal(game.fen(), example.after);
      assert.equal(move.piece, example.piece);
      assert.equal(move.captured || null, example.captured);
      assert.equal(game.isCheck(), example.check);
      assert.equal(game.isCheckmate(), example.mate);
      assert(positions.get(fen).children.some(child => child.move === move.lan), `${item.slug}: hint outside course`);
      for (const claim of example.claims) {
        claimCount++;
        if (claim.type === 'fork' || claim.type === 'attack') {
          if (claim.type === 'fork') assert(claim.targets.length >= 2);
          for (const square of claim.targets) {
            const target = game.get(square);
            assert(target && target.color !== move.color);
            if (target.type === 'k') assert(game.isCheck());
            else assert(canCapture(game, move.color, move.to, square), `${item.slug}: false capture threat`);
          }
        } else if (claim.type === 'discovered-attack') {
          for (const square of claim.attackers) {
            assert(canCapture(game, move.color, square, claim.target));
            assert(!canCapture(new Chess(fen), move.color, square, claim.target));
          }
        } else if (claim.type === 'discovered-check') {
          assert(game.isCheck());
          assert(claim.attackers.every(square => square !== move.to));
        } else if (claim.type === 'pin' || claim.type === 'skewer') {
          checkRay(game, move.to, claim.front, claim.back);
          assert(game.get(claim.front).color !== move.color);
          assert.equal(game.get(claim.front).color, game.get(claim.back).color);
          assert(['b', 'r', 'q'].includes(game.get(move.to).type));
          if (claim.type === 'pin') assert(['k', 'q'].includes(game.get(claim.back).type));
          else assert.equal(game.get(claim.front).type, 'k');
        } else if (claim.type === 'sacrifice') {
          const node = positions.get(game.fen());
          assert(node.children.some(child => {
            const replyGame = new Chess(game.fen());
            const reply = replyGame.move({ from: child.move.slice(0, 2), to: child.move.slice(2, 4), promotion: child.move[4] });
            return reply.to === claim.square && reply.captured === move.piece;
          }));
        } else throw Error(`Unknown tactical claim ${claim.type}`);
      }
    }
  }
  assertBulgarian(notes.description, `${item.slug}: course description`);
  const counts = { lines: leaves.length, nodes: all.length, notes: all.filter(node => node.notes).length };
  practices.push({ slug: item.slug, name: notes.name, description: notes.description, playerColor: source.playerSide === 'w' ? 'WHITE' : 'BLACK', localization: localized.localization, counts, tree });
  report.push({ slug: item.slug, name: notes.name, playerColor: source.playerSide === 'w' ? 'WHITE' : 'BLACK', sourceLines: source.lines.length, ...counts, removedPrefixes: localized.localization.removedPrefixes, checkmatedStudentEndpoints: leaves.filter(node => { const game = new Chess(node.fen); return game.isCheckmate() && game.turn() === source.playerSide; }).length });
  console.log(`${item.slug}: verified ${counts.lines} lines / ${counts.nodes} nodes / ${counts.notes} Bulgarian notes`);
}
assert.equal(practices.length, 20);
assert.equal(new Set(practices.map(practice => practice.name)).size, 20);
const totals = report.reduce((result, item) => { for (const key of ['lines', 'nodes', 'notes']) result[key] += item[key]; return result; }, { lines: 0, nodes: 0, notes: 0 });
writeJson(path.join(directory, 'practices.json'), { formatVersion: 1, language: 'bg', coachLichessId: 'roshavi4ak', practices });
writeJson(path.join(directory, 'validation.json'), { status: 'VALIDATED_LOCALLY', tacticalClaimsChecked: claimCount, totals, practices: report });
console.log(JSON.stringify({ practices: 20, ...totals, tacticalClaimsChecked: claimCount }));
