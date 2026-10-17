/* eslint-disable @typescript-eslint/no-require-imports -- These .cjs tools use Node's CommonJS runtime. */
// Newly authored Bulgarian coaching text, grounded in the actual board and course moves.
// This is an adaptation of the practice positions, not a literal translation service.
const { Chess } = require('chess.js');
const pieceNames = { p: 'пешката', n: 'коня', b: 'офицера', r: 'топа', q: 'дамата', k: 'царя' };
const promotionNames = { n: 'кон', b: 'офицер', r: 'топ', q: 'дама' };
const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const other = color => color === 'w' ? 'b' : 'w';
const squareXY = square => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
const squareAt = (x, y) => String.fromCharCode(97 + x) + (y + 1);
const list = items => items.length < 2 ? items[0] : `${items.slice(0, -1).join(', ')} и ${items.at(-1)}`;

function pieces(game) {
  return game.board().flat().filter(Boolean);
}

// Geometric attacks, including a king or a defended piece at the target square.
function attacks(game, piece, target) {
  const [x, y] = squareXY(piece.square);
  const [tx, ty] = squareXY(target);
  const dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  if (piece.type === 'p') return Math.abs(dx) === 1 && dy === (piece.color === 'w' ? 1 : -1);
  if (piece.type === 'n') return Math.abs(dx) * Math.abs(dy) === 2;
  if (piece.type === 'k') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  const diagonal = Math.abs(dx) === Math.abs(dy);
  const straight = !dx || !dy;
  if (!(piece.type === 'q' && (diagonal || straight) || piece.type === 'b' && diagonal || piece.type === 'r' && straight)) return false;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  for (let i = 1; i < Math.max(Math.abs(dx), Math.abs(dy)); i++) {
    if (game.get(squareAt(x + sx * i, y + sy * i))) return false;
  }
  return true;
}

function targets(game, piece) {
  const turnFen = game.fen().split(' ');
  turnFen[1] = piece.color;
  turnFen[3] = '-';
  const legalTargets = new Set(new Chess(turnFen.join(' ')).moves({ square: piece.square, verbose: true }).map(move => move.to));
  return pieces(game).filter(target => target.color !== piece.color && attacks(game, piece, target.square)
    && (target.type === 'k' || legalTargets.has(target.square)));
}

function rays(game, piece) {
  const directions = piece.type === 'b' ? [[1, 1], [-1, 1], [1, -1], [-1, -1]]
    : piece.type === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
      : piece.type === 'q' ? [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]] : [];
  const [x, y] = squareXY(piece.square);
  return directions.map(([dx, dy]) => {
    const hit = [];
    for (let i = 1; i < 8; i++) {
      const tx = x + dx * i, ty = y + dy * i;
      if (tx < 0 || tx > 7 || ty < 0 || ty > 7) break;
      const target = game.get(squareAt(tx, ty));
      if (target) hit.push({ ...target, square: squareAt(tx, ty) });
      if (hit.length === 2) break;
    }
    return hit;
  });
}

function material(game, color) {
  return pieces(game).reduce((total, piece) => total + (piece.color === color ? 1 : -1) * values[piece.type], 0);
}

function moveNote(fen, move, continuations, sourceText = '') {
  const before = new Chess(fen), after = new Chess(fen);
  const actual = after.move(move.san);
  const moved = { ...after.get(actual.to), square: actual.to };
  const attacked = targets(after, moved);
  const enemy = other(actual.color);
  const evidence = { san: actual.san, before: fen, after: after.fen(), piece: actual.piece, from: actual.from, to: actual.to, captured: actual.captured || null, check: after.isCheck(), mate: after.isCheckmate(), claims: [] };
  let instruction;
  if (actual.san === 'O-O') instruction = 'Направете къса рокада с O-O.';
  else if (actual.san === 'O-O-O') instruction = 'Направете дълга рокада с O-O-O.';
  else if (after.isCheckmate()) instruction = `Завършете атаката с ${actual.san} — мат.`;
  else if (actual.promotion) instruction = `Превърнете пешката в ${promotionNames[actual.promotion]} с ${actual.san}.${after.isCheck() ? ' Ходът дава шах.' : ''}`;
  else if (before.isCheck()) instruction = `Отговорете на шаха с ${actual.san}.`;
  else if (after.isCheck()) instruction = `Дайте шах с ${actual.san}.`;
  else if (actual.isEnPassant()) instruction = `Вземете пешката ан пасан с ${actual.san}.`;
  else if (actual.captured) instruction = `Вземете ${pieceNames[actual.captured]} на ${actual.to} с ${actual.san}.`;
  else if (actual.piece === 'p') instruction = `Играйте ${actual.san} и преместете пешката от ${actual.from} на ${actual.to}.`;
  else instruction = `Играйте ${actual.san}, като преместите ${pieceNames[actual.piece]} от ${actual.from} на ${actual.to}.`;
  if (after.isCheckmate()) return { text: instruction + ' Царят няма легална защита срещу шаха.', evidence };
  if (actual.isKingsideCastle() || actual.isQueensideCastle()) return { text: instruction + ' Царят напуска центъра, а топът се включва в играта.', evidence };

  const motifs = [];
  // Only attach source sacrifice language when the saved continuation actually takes it.
  const replies = continuations.get(after.fen()) || [];
  const sacrificed = /sacrific|sacrifice|sac |giving up/i.test(sourceText) && values[actual.piece] > values[actual.captured || 'k']
    && replies.some(reply => reply.to === actual.to && reply.captured === actual.piece);
  if (sacrificed) {
    instruction = `Жертвайте ${pieceNames[actual.piece]} с ${actual.san}.`;
    motifs.push('След приемане на жертвата търсете активна игра и пресметнете отговорите точно.');
    evidence.claims.push({ type: 'sacrifice', square: actual.to });
  }
  const valuable = attacked.filter(p => p.type === 'k' || p.type === 'q' || values[p.type] >= values[actual.piece] && p.type !== 'p');
  if (valuable.length >= 2) {
    motifs.push(`Едновременно нападате ${list(valuable.map(p => `${pieceNames[p.type]} на ${p.square}`))}.`);
    evidence.claims.push({ type: 'fork', targets: valuable.map(p => p.square) });
  }
  const enemyKing = pieces(after).find(p => p.color === enemy && p.type === 'k');
  if (after.isCheck() && !attacks(after, moved, enemyKing.square)) {
    const checkers = pieces(after).filter(p => p.color === actual.color && attacks(after, p, enemyKing.square));
    motifs.push(`При отместването на фигурата откривате шах от ${list(checkers.map(p => `${pieceNames[p.type]} на ${p.square}`))}.`);
    evidence.claims.push({ type: 'discovered-check', attackers: checkers.map(p => p.square) });
  }
  const queen = pieces(after).find(p => p.color === enemy && p.type === 'q');
  if (queen) {
    const discovered = pieces(after).filter(p => p.color === actual.color && p.square !== actual.to && targets(after, p).some(target => target.square === queen.square)
      && !attacks(before, p, queen.square));
    if (discovered.length) {
      motifs.push(`Откривате нападение срещу дамата на ${queen.square} от ${list(discovered.map(p => `${pieceNames[p.type]} на ${p.square}`))}.`);
      evidence.claims.push({ type: 'discovered-attack', target: queen.square, attackers: discovered.map(p => p.square) });
    }
  }
  for (const [front, back] of rays(after, moved)) {
    if (!front || !back || front.color !== enemy || back.color !== enemy) continue;
    if (front.type !== 'k' && (back.type === 'k' || back.type === 'q' && values[front.type] < 9)) {
      motifs.push(`Свързвате ${pieceNames[front.type]} на ${front.square} към ${pieceNames[back.type]} на ${back.square}.`);
      evidence.claims.push({ type: 'pin', front: front.square, back: back.square });
    } else if (front.type === 'k' && back.type === 'q') {
      motifs.push(`Царят и дамата на ${back.square} са на една линия. Търсете пронизване, ако царят отстъпи.`);
      evidence.claims.push({ type: 'skewer', front: front.square, back: back.square });
    }
  }
  if (!motifs.length && attacked.some(p => p.type === 'q' || p.type === 'r' || actual.piece === 'p' && ['b', 'n'].includes(p.type))) {
    const threats = attacked.filter(p => p.type === 'q' || p.type === 'r' || actual.piece === 'p' && ['b', 'n'].includes(p.type));
    motifs.push(`Нападате ${list(threats.map(p => `${pieceNames[p.type]} на ${p.square}`))} и създавате заплаха, на която противникът трябва да отговори.`);
    evidence.claims.push({ type: 'attack', targets: threats.map(p => p.square) });
  }
  if (!motifs.length && actual.isEnPassant()) motifs.push('Вземането е възможно само непосредствено след двойния ход на противниковата пешка.');
  if (!motifs.length && actual.promotion) motifs.push('Проверете следващия шах или вземане с новата фигура.');
  if (!motifs.length && actual.piece === 'r') {
    const filePawns = pieces(after).filter(p => p.type === 'p' && p.square[0] === actual.to[0]);
    if (!filePawns.length) motifs.push(`Топът заема отворената линия ${actual.to[0]}. Търсете проникване по нея и координация с останалите фигури.`);
    else if (!filePawns.some(p => p.color === actual.color)) motifs.push(`Топът заема полуотворената линия ${actual.to[0]} и може да упражнява натиск върху противниковите пешки.`);
    else motifs.push('Подобрявате разположението на топа. Следете кои централни линии могат да се отворят.');
  }
  if (!motifs.length && actual.piece === 'b' && ['b2', 'g2', 'b7', 'g7'].includes(actual.to) && ['c1', 'f1', 'c8', 'f8'].includes(actual.from))
    motifs.push('Развивате офицера чрез фианкето и подготвяте натиск по дългия диагонал.');
  if (!motifs.length && actual.piece === 'n' && ['b1', 'g1', 'b8', 'g8'].includes(actual.from)) motifs.push('Развивате коня и увеличавате контрола над централните полета.');
  if (!motifs.length && actual.piece === 'b' && ['c1', 'f1', 'c8', 'f8'].includes(actual.from)) motifs.push('Включвате офицера в играта. Следете активния му диагонал и подгответе безопасност за царя.');
  if (!motifs.length && actual.captured && before.get(actual.to)?.type === actual.piece) motifs.push('Разменяте еднотипни фигури. След размяната сравнете активността и пешечната структура.');
  if (!motifs.length && actual.captured) motifs.push('След вземането проверете как противникът може да отвърне и кои линии се отварят.');
  if (!motifs.length && actual.piece === 'p') {
    if (['d', 'e'].includes(actual.to[0])) motifs.push('Променяте централната пешечна структура. Проверете кои диагонали и линии се отварят за фигурите.');
    else if (['b', 'g'].includes(actual.to[0]) && ['2', '3', '6', '7'].includes(actual.to[1])) motifs.push('Подготвяте фланговата подредба. Следете диагонала на офицера и слабостите, които пешката оставя зад себе си.');
    else motifs.push('Печелите флангово пространство. Проверете как пешечният ход променя защитата на царя и полетата за фигурите.');
  }
  if (!motifs.length && actual.piece === 'k') motifs.push('Променяте позицията на царя. Проверете противниковите шахове и свободните полета около него.');
  if (!motifs.length && before.isAttacked(actual.from, enemy) && !after.isAttacked(actual.to, enemy)) motifs.push('Извеждате фигурата от непосредственото нападение и я запазвате за следващия план.');
  if (!motifs.length) motifs.push('Подобрявате разположението на фигурата. Съгласувайте следващия ход с центъра и безопасността на царя.');
  return { text: `${instruction} ${motifs.slice(0, 2).join(' ')}`, evidence };
}

function positionNote(fen, continuations, color, sourceText) {
  const moves = continuations.get(fen) || [];
  if (!moves.length) throw new Error(`A terminal position needs a reviewed closing note with its line history: ${fen}`);
  if (new Chess(fen).turn() !== color) return {
    text: `Следва ход на противника. В упражнението са включени ${list(moves.map(move => move.san))}. Следете как отговорът променя заплахите в центъра и към царя.`,
    evidence: [],
  };
  const choices = moves.map(move => moveNote(fen, move, continuations, sourceText));
  return {
    text: choices.length === 1 ? choices[0].text : `Курсът разглежда ${choices.length} продължения в тази позиция. ${choices.map(choice => choice.text).join(' ')}`,
    evidence: choices.map(choice => choice.evidence),
  };
}

module.exports = { positionNote, moveNote, attacks, pieces, rays, material };
