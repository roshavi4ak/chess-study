/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
// Rules behind the "Play & learn" features: puzzle ladders, races, bots, mini-games, levels, leagues,
// tournaments, fun-session activity, and the translation keys those features build at runtime.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const loaded = new Map();
function loadSource(relativePath) {
    const filename = path.resolve(__dirname, relativePath);
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const mod = new Module(filename, module);
    loaded.set(filename, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = mod.require.bind(mod);
    mod.require = name => name.startsWith('./')
        ? loadSource(path.relative(__dirname, path.resolve(path.dirname(filename), `${name}.ts`)))
        : originalRequire(name);
    mod._compile(output, filename);
    return mod.exports;
}

const at = (day, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+03:00`);

// ----- Puzzle ladder -----
const { pickLadder, streakStart } = loadSource('../src/lib/puzzleLadder.ts');
const pool = [900, 1000, 1010, 1100, 1200, 1300].map((rating, index) => ({ id: `p${index}`, fen: '', solution: '', rating }));
assert.deepEqual(pickLadder(pool, 1000, 100, 4).map(p => p.rating), [1000, 1100, 1200, 1300]);
assert.equal(new Set(pickLadder(pool, 1000, 0, 6).map(p => p.id)).size, 6, 'no puzzle twice');
assert.equal(pickLadder(pool, 1000, 100, 10).length, 6, 'stops when the pool runs out');
assert.equal(streakStart(1500), 1200);
assert.equal(streakStart(500), 400, 'never below the easiest puzzles');
assert.equal(streakStart(null), 900);

// ----- Coordinates -----
const { randomSquare } = loadSource('../src/lib/coordinates.ts');
let previous = 'e4';
for (let i = 0; i < 500; i++) {
    const square = randomSquare(previous);
    assert.match(square, /^[a-h][1-8]$/);
    assert.notEqual(square, previous);
    previous = square;
}

// ----- Puzzle race -----
const race = loadSource('../src/lib/puzzleRace.ts');
let racer = race.newRacer();
for (let i = 0; i < 5; i++) racer = race.applyRaceEvent(racer, { index: i, result: 'solved' }, 80);
assert.deepEqual([racer.score, racer.solved, racer.combo, racer.bonuses], [6, 5, 5, 1], 'combo of 5 adds a bonus');
racer = race.applyRaceEvent(racer, { index: 5, result: 'skip' }, 80);
assert.deepEqual([racer.nextIndex, racer.combo, racer.skipped], [6, 5, true], 'a skip keeps the combo');
assert.equal(race.applyRaceEvent(racer, { index: 6, result: 'skip' }, 80), null, 'only one skip');
assert.equal(race.applyRaceEvent(racer, { index: 9, result: 'solved' }, 80), null, 'answers must be in order');
racer = race.applyRaceEvent(racer, { index: 6, result: 'failed' }, 80);
assert.deepEqual([racer.score, racer.combo, racer.nextIndex], [6, 0, 7], 'a mistake empties the combo');
for (let i = 7; i < 17; i++) racer = race.applyRaceEvent(racer, { index: i, result: 'solved' }, 80);
assert.equal(racer.score, 6 + 10 + 2 + 3, 'second and third bonuses grow');
assert.equal(race.applyRaceEvent(race.newRacer(), { index: 0, result: 'solved' }, 0), null, 'no puzzles, no answers');
const startsAt = at('2026-10-14', 10);
const endsAt = new Date(startsAt.getTime() + 90000);
assert.equal(race.racePhase({ startsAt: null, endsAt: null }, startsAt), 'waiting');
assert.equal(race.racePhase({ startsAt, endsAt }, new Date(startsAt.getTime() - 1000)), 'countdown');
assert.equal(race.racePhase({ startsAt, endsAt }, new Date(startsAt.getTime() + 1000)), 'running');
assert.equal(race.racePhase({ startsAt, endsAt }, endsAt), 'finished');
assert.match(race.randomRaceCode(), /^\d{4}$/);
assert.deepEqual(race.rankRacers([{ score: 3, solved: 3, name: 'B' }, { score: 5, solved: 4, name: 'A' }, { score: 3, solved: 3, name: 'A' }]).map(r => `${r.name}${r.score}`), ['A5', 'A3', 'B3']);

// ----- Bots and cards -----
const { BOTS, unlockedBots } = loadSource('../src/lib/bots.ts');
const { botCards, worldCards, tournamentCards, earnedKeys } = loadSource('../src/lib/masteryCards.ts');
assert.deepEqual([...unlockedBots(new Set())], ['sloth']);
assert.deepEqual([...unlockedBots(new Set(['sloth', 'penguin']))], ['sloth', 'penguin', 'koala']);
assert.equal(new Set(BOTS.map(bot => bot.id)).size, BOTS.length);
const cards = Object.fromEntries(botCards({ sloth: 5, penguin: 3, koala: 1 }).map(card => [card.tag, [card.tier, card.nextTarget]]));
assert.deepEqual(cards.sloth, ['gold', null]);
assert.deepEqual(cards.penguin, ['silver', 5]);
assert.deepEqual(cards.koala, ['bronze', 3]);
assert.deepEqual(cards.lion, [null, 1]);
assert.deepEqual(tournamentCards(5).map(card => [card.tier, card.nextTarget]), [['silver', 15]]);
assert.deepEqual(earnedKeys(tournamentCards(1)), ['tournament:bronze']);

// ----- Mini-games -----
const mini = loadSource('../src/lib/miniGames.ts');
const set = (...squares) => new Set(squares);
assert.deepEqual(mini.pieceMoves('R', 'a1', set('a3'), set()).sort(), ['a2', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'].sort(), 'friendly pawns block a rook');
assert.deepEqual(mini.pieceMoves('R', 'a1', set(), set('a2')).sort(), ['a2', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'], 'a rook stops on a capture');
assert.deepEqual(mini.pieceMoves('N', 'a1', set(), set()).sort(), ['b3', 'c2']);
assert.deepEqual(mini.pieceMoves('N', 'a1', set('a2', 'b2', 'b1'), set()).sort(), ['b3', 'c2'], 'knights jump over friendly pawns');
assert.deepEqual(mini.pieceMoves('P', 'e2', set(), set()).sort(), ['e3', 'e4'], 'pawns may step twice from the start');
assert.deepEqual(mini.pieceMoves('P', 'e3', set(), set('d4', 'e4')), ['d4'], 'pawns capture diagonally, not forward');
assert.deepEqual(mini.pieceMoves('P', 'e7', set(), set(), -1).sort(), ['e5', 'e6'], 'black pawns move down');
const ids = new Set();
for (const world of mini.WORLDS) {
    assert.equal(world.levels.length, 6, `${world.id} has 6 levels`);
    for (const level of world.levels) {
        assert.ok(!ids.has(level.id), `${level.id} is unique`);
        ids.add(level.id);
        if (level.type !== 'board') continue;
        const solution = mini.solve(level);
        assert.ok(solution, `${level.id} can be solved`);
        assert.ok(solution.length <= 8, `${level.id} needs ${solution.length} moves`);
        let state = mini.startState(level);
        let outcome = null;
        for (const square of solution) {
            outcome = mini.playMove(level, state, square);
            state = outcome.state;
        }
        assert.equal(outcome.result, 'won', `${level.id} solution wins`);
    }
}
// Fixed friendly pawns replace the old obstacles; only the highlighted piece moves.
const rookWithPawns = mini.findLevel('rook-6');
const rookState = mini.startState(rookWithPawns);
assert.deepEqual(rookWithPawns.friendlyPawns, ['e6', 'c4', 'b7']);
assert.equal(mini.playMove(rookWithPawns, rookState, 'e6'), null, 'cannot capture an own pawn');
assert.equal(mini.playMove(rookWithPawns, rookState, 'e8'), null, 'cannot jump over the pawn on e6');
assert.equal(mini.playMove(rookWithPawns, rookState, 'a4'), null, 'the pawn on c4 blocks the left ray');
assert.equal(mini.playMove(rookWithPawns, rookState, 'e7', 'e6'), null, 'a fixed pawn cannot be moved');
assert.equal(mini.playMove(rookWithPawns, rookState, 'e5').state.at, 'e5', 'the active rook can move');
const pawnWithFriend = mini.findLevel('pawn-3');
const pawnState = mini.startState(pawnWithFriend);
assert.equal(mini.playMove(pawnWithFriend, pawnState, 'e3', 'd3'), null, 'only the active pawn moves, even when both are white pawns');
assert.equal(mini.playMove(pawnWithFriend, pawnState, 'e3', 'd2').result, 'ok', 'the active pawn can capture diagonally');
assert.deepEqual(mini.pieceMoves('N', 'a1', set('a2', 'b2', 'b3'), set()), ['c2'], 'a knight jumps over pawns but cannot land on one');
for (const world of mini.WORLDS) for (const level of world.levels) {
    if (level.type !== 'board') continue;
    assert.ok(!Object.hasOwn(level, 'rocks'), 'all board obstacles are chess pieces');
    const occupied = new Set([level.start, ...(level.apples ?? []), level.star, ...(level.targets ?? []).map(p => p.square), ...(level.guards ?? []).map(p => p.square)]);
    for (const square of level.friendlyPawns ?? []) {
        assert.match(square, /^[a-h][2-7]$/, `${level.id}: fixed pawns do not sit on promotion or first ranks`);
        assert.ok(!occupied.has(square), `${level.id}: pawn does not overlap a piece or goal`);
        occupied.add(square);
    }
}
for (const locale of ['en', 'bg']) {
    const messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../messages/${locale}.json`), 'utf8')).MiniGames;
    assert.ok(messages.friendlyPawns && messages.friendlyPawnsKnight);
    for (const piece of 'RBQKNP') assert.ok(messages[`piece_${piece}`]);
}

const guarded = mini.findLevel('capture-5');
assert.equal(mini.playMove(guarded, mini.startState(guarded), 'a8').result, 'ok');
const guardedSquare = [...mini.guardedSquares(guarded)].find(square => mini.legalTargets(guarded, mini.startState(guarded)).includes(square));
if (guardedSquare) assert.equal(mini.playMove(guarded, mini.startState(guarded), guardedSquare).result, 'caught');
assert.equal(mini.playMove(guarded, mini.startState(guarded), 'b2'), null, 'illegal moves are refused');

// Capture Island: capturable black pieces also attack, not just fixed guards.
const captureIsland = mini.findLevel('capture-4');
const afterFirstMove = mini.playMove(captureIsland, mini.startState(captureIsland), 'd5');
assert.equal(afterFirstMove.result, 'ok');
assert.ok(mini.guardedSquares(captureIsland, afterFirstMove.state).has('c5'), 'the knight on a4 guards c5');
const knightCapture = mini.playMove(captureIsland, afterFirstMove.state, 'c5');
assert.equal(knightCapture.result, 'caught', 'the queen on c5 is taken by the knight on a4');
assert.deepEqual(knightCapture.capturedBy, { square: 'a4', piece: 'N' });

const isolatedKnight = { ...captureIsland, goal: 'star', star: 'h8', targets: [{ square: 'a4', piece: 'N' }] };
const captureKnight = mini.playMove(isolatedKnight, mini.startState(isolatedKnight), 'a4');
assert.equal(captureKnight.result, 'ok', 'an undefended target can be captured');
assert.ok(!mini.guardedSquares(isolatedKnight, captureKnight.state).has('c5'), 'a captured knight no longer guards c5');

const defendedTarget = { type: 'board', id: 'defended-target', piece: 'Q', start: 'c1', goal: 'capture', targets: [{ square: 'c3', piece: 'N' }, { square: 'a3', piece: 'R' }] };
assert.ok(mini.guardedSquares(defendedTarget).has('c3'), 'friendly pieces defend occupied squares');
assert.ok(!mini.guardedSquares(defendedTarget).has('d3'), 'a friendly piece blocks the rook ray beyond it');
assert.equal(mini.playMove(defendedTarget, mini.startState(defendedTarget), 'c3').result, 'caught', 'taking a defended target loses the white piece');

const revealedRook = { type: 'board', id: 'revealed-rook', piece: 'Q', start: 'b1', goal: 'star', star: 'h8', targets: [{ square: 'd4', piece: 'P' }], guards: [{ square: 'a4', piece: 'R' }] };
assert.ok(!mini.guardedSquares(revealedRook).has('e4'), 'a target blocks a guard ray');
const afterRemovingBlocker = { ...mini.startState(revealedRook), at: 'b1', captured: ['d4'] };
assert.ok(mini.guardedSquares(revealedRook, afterRemovingBlocker).has('e4'), 'removing a target exposes the guard ray');
assert.ok(mini.guardedSquares({ ...revealedRook, start: 'b4', targets: [] }).has('c4'), 'the moving white piece cannot hide danger behind itself');

const rookBlockedByPawn = { ...revealedRook, targets: [], friendlyPawns: ['d4'] };
assert.ok(mini.guardedSquares(rookBlockedByPawn).has('d4'), 'an enemy rook attacks the friendly pawn occupying its ray');
assert.ok(!mini.legalTargets(rookBlockedByPawn, mini.startState(rookBlockedByPawn)).includes('d4'), 'the practising piece cannot capture its own pawn');
assert.ok(!mini.guardedSquares(rookBlockedByPawn).has('e4'), 'friendly pawns block attack rays beyond their own square');

const blackPawn = { type: 'board', id: 'black-pawn-danger', piece: 'Q', start: 'd1', goal: 'capture', targets: [{ square: 'd4', piece: 'P' }] };
assert.deepEqual([...mini.guardedSquares(blackPawn)].sort(), ['c3', 'e3'], 'black pawns guard diagonally down, including empty squares');
const lastCapture = mini.playMove(blackPawn, mini.startState(blackPawn), 'd4');
assert.equal(lastCapture.result, 'won', 'the captured last target cannot take the white piece');

const kingGuardLevel = mini.findLevel('capture-6');
assert.ok(mini.guardedSquares(kingGuardLevel).has('e3'), 'the bishop on c5 guards e3');
assert.ok(mini.guardedSquares(kingGuardLevel).has('f2'), 'the knight on h3 guards f2');
assert.equal(mini.playMove(kingGuardLevel, mini.startState(kingGuardLevel), 'f2').result, 'caught', 'guarded star levels still catch unsafe king moves');
assert.deepEqual([3, 4, 5, 6].map(moves => mini.boardStars(moves, 3)), [3, 2, 2, 1]);
assert.deepEqual([5, 4, 3, 2].map(correct => mini.puzzleStars(correct, 5)), [3, 2, 1, 0]);
// Pawn wars
const pawns = { white: ['a6'], black: ['h7'], turn: 'w' };
assert.equal(mini.pawnWinner(mini.applyPawnMove(mini.applyPawnMove(pawns, { from: 'a6', to: 'a7' }), { from: 'h7', to: 'h6' })), null);
assert.equal(mini.pawnWinner({ white: ['a8'], black: ['h7'], turn: 'b' }), 'w');
assert.equal(mini.pawnWinner({ white: ['e4'], black: ['e5'], turn: 'w' }), 'b', 'a player with no moves loses');
assert.deepEqual(mini.computerPawnMove({ white: ['a2'], black: ['b2', 'h7'], turn: 'b' }, () => 0.5), { from: 'b2', to: 'b1' }, 'the computer takes a winning move');
const world = mini.WORLDS[0];
const key = level => mini.miniKey(level.id);
assert.equal(mini.worldTier(world, {}), null);
assert.equal(mini.worldTier(world, Object.fromEntries(world.levels.map(level => [key(level), 2]))), 'silver');
assert.equal(mini.levelOpen(world, 1, {}), false);
assert.equal(mini.levelOpen(world, 1, { [key(world.levels[0])]: 1 }), true);
const worldCard = worldCards(Object.fromEntries(world.levels.map(level => [key(level), 1])))[0];
assert.deepEqual([worldCard.tier, worldCard.current, worldCard.nextTarget], ['bronze', 6, 12]);

// ----- Levels -----
const curriculum = loadSource('../src/lib/curriculum.ts');
let progress = curriculum.levelProgress([], 0, null);
assert.equal(progress.current.id, 'pawn-1');
progress = curriculum.levelProgress(['pawn-1', 'pawn-2'], 0, null);
assert.equal(progress.current.id, 'pawn-3');
progress = curriculum.levelProgress([], 0, 'knight-1');
assert.equal(progress.current.id, 'knight-1', 'a coach can place a child further on');
assert.ok(progress.passed.has('pawn-3'), 'earlier levels count as passed');
progress = curriculum.levelProgress(curriculum.CURRICULUM.map(level => level.id), 2, null);
assert.equal(progress.current.id, curriculum.KING_LEVEL.id);
assert.equal(progress.kingRating, curriculum.KING_START + 2 * curriculum.KING_STEP);
assert.equal(curriculum.testPassed(curriculum.TEST_PASS), true);
assert.equal(curriculum.testPassed(curriculum.TEST_PASS - 1), false);

// ----- Leagues -----
const leagues = loadSource('../src/lib/leagues.ts');
const members = Array.from({ length: 25 }, (_, index) => ({ id: `u${String(index).padStart(2, '0')}`, tier: 'WOOD' }));
const groups = leagues.formGroups([...members, { id: 'z', tier: 'GOLD' }]);
assert.deepEqual(groups.map(group => [group.tier, group.members.length]), [['WOOD', 9], ['WOOD', 9], ['WOOD', 7], ['GOLD', 1]]);
assert.deepEqual(leagues.formGroups([...members].reverse()).map(group => group.members.map(m => m.id)), leagues.formGroups(members).map(group => group.members.map(m => m.id)), 'groups do not depend on order');
const ranked = leagues.rankGroup([
    { id: 'a', name: 'A', points: 10 }, { id: 'b', name: 'B', points: 30 }, { id: 'c', name: 'C', points: 20 },
    { id: 'd', name: 'D', points: 5 }, { id: 'e', name: 'E', points: 0 },
], 'WOOD');
assert.deepEqual(ranked.map(row => [row.id, row.rank, row.promotes]), [['b', 1, true], ['c', 2, true], ['a', 3, true], ['d', 4, false], ['e', 5, false]]);
assert.equal(leagues.rankGroup([{ id: 'x', name: 'X', points: 0 }], 'WOOD')[0].promotes, false, 'no points, no promotion');
assert.equal(leagues.rankGroup([{ id: 'x', name: 'X', points: 99 }], 'DIAMOND')[0].promotes, false, 'Diamond is the top');
assert.equal(leagues.nextTier('WOOD'), 'STONE');
assert.equal(leagues.nextTier('DIAMOND'), 'DIAMOND');

// ----- Lichess tournaments -----
const tournaments = loadSource('../src/lib/lichessTournaments.ts');
assert.deepEqual(tournaments.parseTournamentUrl('https://lichess.org/tournament/nomzScLP'), { kind: 'ARENA', lichessId: 'nomzScLP' });
assert.deepEqual(tournaments.parseTournamentUrl('lichess.org/bg/swiss/8UfHWBP7?x=1'), { kind: 'SWISS', lichessId: '8UfHWBP7' });
assert.deepEqual(tournaments.parseTournamentUrl('https://lichess.org/tournament/abcdEFGH/'), { kind: 'ARENA', lichessId: 'abcdEFGH' });
assert.equal(tournaments.parseTournamentUrl('https://lichess.org/study/abcdEFGH'), null);
assert.equal(tournaments.parseTournamentUrl('https://example.com/tournament/abcdEFGH'), null);
const arena = tournaments.parseTournamentInfo('ARENA', { fullName: '≤1300 Bullet Arena', startsAt: '2026-10-13T20:30:40Z', minutes: 27, isFinished: true });
assert.deepEqual([arena.name, arena.finished, arena.finishesAt.toISOString()], ['≤1300 Bullet Arena', true, '2026-10-13T20:57:40.000Z']);
const swiss = tournaments.parseTournamentInfo('SWISS', { name: 'Rapid Increment', startsAt: '2026-10-16T23:30:00Z', status: 'created' });
assert.deepEqual([swiss.name, swiss.finished, swiss.finishesAt], ['Rapid Increment', false, null]);
assert.deepEqual(tournaments.parseResults('{"rank":1,"score":10,"username":"Orats"}\n{"rank":2,"points":4.5,"username":"aulig"}\n'),
    [{ lichessId: 'orats', rank: 1, score: 10 }, { lichessId: 'aulig', rank: 2, score: 4.5 }]);

// ----- Fun sessions count as activity -----
const { buildDailyMission } = loadSource('../src/lib/dailyMission.ts');
const { weeklyEffort, MAX_PLAY_POINTS } = loadSource('../src/lib/effortBoard.ts');
const play = day => ({ kind: 'STREAK', key: '', score: 3, won: null, createdAt: at(day) });
const mission = buildDailyMission({ now: at('2026-10-14'), practiceAttempts: [], puzzleAttempts: [], practices: new Map(), playSessions: [play('2026-10-13')] });
assert.deepEqual(mission.week.days.filter(day => day.active).map(day => day.day), ['2026-10-13']);
const effort = weeklyEffort({ now: at('2026-10-14'), practiceAttempts: [], puzzleAttempts: [], practices: new Map(), playSessions: Array.from({ length: 30 }, () => play('2026-10-14')) });
assert.equal(effort.playSessions, 30);
assert.equal(effort.effortPoints, 10 + MAX_PLAY_POINTS, 'fun sessions are capped');

// ----- Translation keys built at runtime -----
const messages = Object.fromEntries(['en', 'bg'].map(lang => [lang, JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'messages', `${lang}.json`), 'utf8'))]));
const needed = [
    ...BOTS.flatMap(bot => ['Name', 'Intro', 'Greeting', 'Capture', 'Check', 'BotWins', 'ChildWins', 'Draw'].map(line => `Bots.${bot.id}${line}`)),
    ...mini.WORLDS.flatMap(entry => ['Name', 'Tagline', 'Story'].map(part => `MiniGames.${entry.id}${part}`)),
    ...[...curriculum.CURRICULUM, curriculum.KING_LEVEL].map(level => `Levels.lesson_${level.id}`),
    ...['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'].map(group => `Levels.group_${group}`),
    ...leagues.LEAGUE_TIERS.map(tier => `Leagues.tier_${tier}`),
    ...['practices', 'themes', 'bots', 'worlds', 'tournaments'].flatMap(section => [`Cards.${section}Title`, `Cards.${section}Rule`]),
    ...['practices', 'themes'].flatMap(section => [`Cards.${section}Empty`, `Cards.${section}Start`]),
    ...['practice', 'theme', 'bot', 'world', 'tournament'].map(kind => `Cards.${kind}Progress`),
    ...['bronze', 'silver', 'gold'].map(tier => `Cards.${tier}`),
    ...['bots', 'games', 'streak', 'race', 'coordinates', 'levels', 'tournaments', 'cards', 'certificates'].flatMap(tile => [`FunHub.${tile}Title`, `FunHub.${tile}Text`]),
    ...['notFound', 'started', 'full'].map(reason => `Race.join_${reason}`),
    ...['easy', 'medium', 'hard'].map(level => `Race.level_${level}`),
    ...['badLink', 'notFound', 'duplicate'].map(reason => `Tournaments.add_${reason}`),
];
for (const lang of ['en', 'bg']) {
    for (const key of needed) {
        const value = key.split('.').reduce((node, part) => node?.[part], messages[lang]);
        assert.equal(typeof value, 'string', `${lang} is missing ${key}`);
    }
}

console.log('Fun mode checks passed (ladders, races, bots, mini-games, levels, leagues, tournaments, activity, runtime translation keys).');
