/* eslint-disable @typescript-eslint/no-require-imports -- Offline content generation, never writes the database. */
const fs = require('node:fs');
const path = require('node:path');
const { Chess } = require('chess.js');
const output = path.resolve(__dirname, '../src/lib/endgameStarts.json');
const count = Number(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1] || 40);
const ids = ['queenMate', 'rookMate', 'promotion', 'opposition', 'holdDraw', 'bishopPairMate', 'bishopKnightMate'];
const data = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {
  source: 'https://tablebase.lichess.ovh/standard', verifiedAt: new Date().toISOString(), positions: {},
};
const pick = values => values[Math.floor(Math.random() * values.length)];
const squares = Array.from({ length: 64 }, (_, i) => 'abcdefgh'[i % 8] + (1 + Math.floor(i / 8)));
const distance = (a, b) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));
function candidate(id) {
  const game = new Chess(); game.clear();
  const white = pick(squares), black = pick(squares);
  if (distance(white, black) < 2) return null;
  game.put({ type: 'k', color: 'w' }, white); game.put({ type: 'k', color: 'b' }, black);
  const free = () => pick(squares.filter(square => !game.get(square)));
  if (id === 'promotion' || id === 'opposition') {
    const pawn = pick(squares.filter(square => !game.get(square) && '23456'.includes(square[1]) && !'ah'.includes(square[0])));
    if (distance(white, pawn) >= distance(black, pawn) || distance(white, pawn) > 2) return null;
    if (id === 'opposition' && (Number(white[1]) <= Number(pawn[1]) || distance(white, black) > 3)) return null;
    game.put({ type: 'p', color: 'w' }, pawn);
  } else if (id === 'holdDraw') {
    const pawn = pick(['a3', 'a4', 'a5', 'a6', 'h3', 'h4', 'h5', 'h6']);
    if (game.get(pawn) || distance(black, pawn) > 2 || distance(white, pawn) > 3) return null;
    game.put({ type: 'p', color: 'b' }, pawn);
  } else if (id === 'queenMate' || id === 'rookMate') game.put({ type: id === 'queenMate' ? 'q' : 'r', color: 'w' }, free());
  else {
    const bishop = free(); game.put({ type: 'b', color: 'w' }, bishop);
    const color = square => (square.charCodeAt(0) + Number(square[1])) % 2;
    const second = id === 'bishopPairMate' ? pick(squares.filter(square => !game.get(square) && color(square) !== color(bishop))) : free();
    game.put({ type: id === 'bishopPairMate' ? 'b' : 'n', color: 'w' }, second);
  }
  // White moves first: Black cannot have left its own king in check. Reject all terminal starts.
  if (game.isAttacked(black, 'w') || game.inCheck() || game.isGameOver()) return null;
  return game.fen();
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  for (const id of ids) {
    const positions = data.positions[id] ||= [];
    let attempts = 0;
    while (positions.length < count) {
      const fen = candidate(id); if (!fen || positions.some(p => p.fen === fen)) continue;
      let response;
      try { response = await fetch(data.source + '?fen=' + encodeURIComponent(fen), { signal: AbortSignal.timeout(15000) }); }
      catch { await pause(1500); continue; }
      if (response.status === 429) { console.log('Rate limit; backing off'); await pause(60000); continue; }
      if (!response.ok) throw new Error('Tablebase status ' + response.status);
      const table = await response.json(); attempts++;
      if (table.category === (id === 'holdDraw' ? 'draw' : 'win') && (id === 'holdDraw' || table.dtm === null || table.dtm >= 5)) {
        positions.push({ fen, dtm: table.dtm, category: table.category });
        fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
        if (positions.length % 10 === 0) console.log(id, positions.length, 'verified starts;', attempts, 'probes');
      }
      await pause(400);
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
