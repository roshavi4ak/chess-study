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

const { Chess } = require('chess.js');
const curriculum = loadSource('../src/lib/curriculum.ts');
const rules = loadSource('../src/lib/levelExercises.ts');
const { beginnerExercises, startExercise, attemptExerciseMove, retryExercise, showExerciseSolution, nextExerciseMove, exerciseCredit, selectLevelExercises } = rules;
const pawn1 = curriculum.findCurriculumLevel('pawn-1');
assert.deepEqual(pawn1.tags, ['hangingPiece']);
const exercises = beginnerExercises('pawn-1');
assert.equal(exercises.length, 8);
assert.equal(new Set(exercises.map(e => e.id)).size, 8);
assert.equal(beginnerExercises('pawn-2'), null, 'later levels retain their existing tactical themes');
for (const e of exercises) {
    const game = new Chess(e.fen);
    assert.equal(game.board().flat().filter(Boolean).length, 4, 'sparse beginner position');
    assert.equal(game.isCheck(), false, 'student starts without check');
    assert.equal(e.theme, 'hangingPiece');
    assert.equal(e.moves.length, 1, 'one capture, no multi-move tactic');
    const from = e.moves[0].slice(0, 2), to = e.moves[0].slice(2, 4);
    assert.equal(game.isAttacked(to, 'b'), false, 'target is undefended');
    const captures = game.moves({ verbose: true }).filter(m => m.captured);
    assert.equal(captures.length, 1, 'exactly one obvious capture');
    const move = rules.applyExerciseMove(game, e.moves[0]);
    assert.ok(move.captured);
    assert.equal(game.isAttacked(to, 'b'), false, 'capture cannot be recaptured');
    const completed = attemptExerciseMove(e, startExercise(e), { from, to });
    assert.equal(completed.status, 'complete');
    assert.equal(exerciseCredit(completed), true);
    assert.equal(attemptExerciseMove(e, completed, { from, to }), completed, 'late moves ignored');
}
// Practice rounds for Pawn 1 are freshly generated, with the same safety rules as the fixed test.
let seed = 7;
const seeded = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
for (let round = 0; round < 25; round++) {
    const practice = rules.randomHangingExercises(curriculum.TEST_PUZZLES, seeded);
    assert.equal(practice.length, curriculum.TEST_PUZZLES, 'a full practice round');
    assert.equal(new Set(practice.map(item => item.fen)).size, practice.length, 'no repeated positions in a round');
    for (const item of practice) {
        const game = new Chess(item.fen);
        assert.equal(game.turn(), 'w');
        assert.equal(game.board().flat().filter(Boolean).length, 4, 'sparse practice position');
        assert.equal(game.isCheck(), false);
        assert.equal(item.moves.length, 1);
        const to = item.moves[0].slice(2, 4);
        assert.equal(game.isAttacked(to, 'b'), false, 'practice target is undefended');
        assert.equal(game.moves({ verbose: true }).filter(m => m.captured).length, 1, 'exactly one capture');
        const move = rules.applyExerciseMove(game, item.moves[0]);
        assert.ok(move.captured);
        assert.equal(move.promotion, undefined, 'no promotions in beginner practice');
        assert.equal(game.isAttacked(to, 'b'), false, 'practice capture cannot be recaptured');
    }
}

const e = exercises[0];
const wrong = attemptExerciseMove(e, startExercise(e), { from: 'a1', to: 'a2' });
assert.equal(wrong.status, 'wrong');
assert.equal(wrong.fen, e.fen, 'wrong move leaves original board available');
assert.equal(wrong.index, 0);
assert.equal(exerciseCredit(wrong), false);
const retried = retryExercise(e, wrong);
assert.equal(retried.mistakes, 1);
const learned = attemptExerciseMove(e, retried, { from: 'a1', to: 'a5' });
assert.equal(learned.status, 'complete');
assert.equal(exerciseCredit(learned), false, 'retry teaches but does not erase first-attempt failure');
const illegal = attemptExerciseMove(e, startExercise(e), { from: 'a1', to: 'b2' });
assert.equal(illegal.status, 'wrong', 'illegal moves get feedback too');
let solution = showExerciseSolution(e, startExercise(e));
assert.equal(solution.fen, e.fen, 'show solution does not autoplay');
assert.equal(solution.status, 'solution');
solution = nextExerciseMove(e, solution);
assert.equal(solution.status, 'reviewed');
assert.equal(exerciseCredit(solution), false);
assert.equal(exerciseCredit(attemptExerciseMove(e, retryExercise(e, solution), { from: 'a1', to: 'a5' })), false, 'assistance persists on retry');

const multi = { id: 'multi', fen: new Chess().fen(), moves: ['e2e4', 'e7e5', 'g1f3'], theme: 'tactics' };
let attempt = attemptExerciseMove(multi, startExercise(multi), { from: 'e2', to: 'e4' });
assert.equal(attempt.status, 'step');
assert.equal(attempt.index, 1, 'the opponent reply is its own step (the board plays it automatically)');
assert.equal(new Chess(attempt.fen).turn(), 'b');
attempt = nextExerciseMove(multi, attempt);
assert.equal(attempt.status, 'playing');
assert.equal(attempt.index, 2);
attempt = attemptExerciseMove(multi, attempt, { from: 'g1', to: 'f3' });
assert.equal(exerciseCredit(attempt), true);
assert.deepEqual(attempt.played, ['e4', 'e5', 'Nf3']);
let review = showExerciseSolution(multi, startExercise(multi));
for (let i = 1; i <= 3; i++) {
    review = nextExerciseMove(multi, review);
    assert.equal(review.index, i);
    assert.equal(review.status, i === 3 ? 'reviewed' : 'solution');
}

const level = curriculum.findCurriculumLevel('knight-1');
const valid = Array.from({ length: 8 }, (_, i) => ({ id: `valid-${i}`, fen: new Chess().fen(), solution: 'e2e4 e7e5', rating: 600, tags: ['fork'] }));
const excluded = [
    { ...valid[0], id: 'too-hard', rating: 701 },
    { ...valid[0], id: 'too-easy', rating: 499 },
    { ...valid[0], id: 'wrong-theme', tags: ['mateIn1'] },
    { ...valid[0], id: 'bad-line', solution: 'e2e5 e7e5' },
    { ...valid[0], id: 'even-line', solution: 'e2e4 e7e5 g1f3' },
    { ...valid[0], id: 'too-long', solution: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6' },
];
const selected = selectLevelExercises([...excluded, valid[0], valid[0], ...valid.slice(1)], level, 600);
assert.deepEqual(selected.map(x => x.id), valid.map(x => x.id));
assert.equal(selected[0].theme, 'fork');
assert.equal(new Chess(selected[0].fen).turn(), 'b', 'setup move applied before showing goal');
assert.deepEqual(selected[0].moves, ['e7e5']);
assert.deepEqual(selectLevelExercises(valid.slice(0, 7), level, 600), [], 'never substitutes harder or unrelated puzzles');
// Knight 2 only uses mates that the knight gives.
const knight2 = curriculum.findCurriculumLevel('knight-2');
const knightMates = Array.from({ length: 8 }, (_, i) => ({ id: `knight-mate-${i}`, fen: '5r1k/6pp/8/6N1/8/8/8/6K1 b - - 0 1', solution: 'f8g8 g5f7', rating: 700, tags: ['mateIn1', 'smotheredMate'] }));
const queenMate = { id: 'queen-mate', fen: 'k7/8/1K6/8/8/8/8/7Q b - - 0 1', solution: 'a8b8 h1h8', rating: 700, tags: ['mateIn1'] };
const knightTest = selectLevelExercises([queenMate, ...knightMates], knight2, 700);
assert.deepEqual(knightTest.map(x => x.id), knightMates.map(x => x.id), 'mates by other pieces are left out');
assert.ok(knightTest.every(x => x.theme === 'knightMate'));
assert.deepEqual(selectLevelExercises([queenMate, ...knightMates.slice(1)], knight2, 700), [], 'no filling up with other mates');

// Mixed levels fill each topic's share, then top up from the earlier topics, then from the level's other tags.
const quiet = (id, rating, tags) => ({ id, fen: new Chess().fen(), solution: 'e2e4 e7e5', rating, tags });
const rook3 = curriculum.findCurriculumLevel('rook-3');
const themesOf = list => list.reduce((acc, x) => ({ ...acc, [x.theme]: (acc[x.theme] ?? 0) + 1 }), {});
const rookPool = [...Array.from({ length: 10 }, (_, i) => quiet(`rook-${i}`, 900, ['endgame', 'rookEndgame'])), quiet('promo-0', 900, ['promotion']), quiet('promo-1', 900, ['promotion', 'advancedPawn']), quiet('promo-2', 900, ['promotion']), quiet('promo-3', 900, ['promotion'])];
assert.deepEqual(themesOf(selectLevelExercises(rookPool, rook3, 900)), { rookEndgame: 5, promotion: 3 });
assert.deepEqual(themesOf(selectLevelExercises(rookPool.filter(x => !['promo-1', 'promo-2', 'promo-3'].includes(x.id)), rook3, 900)), { rookEndgame: 7, promotion: 1 }, 'missing promotions are replaced by rook endgames');
const queen3 = curriculum.findCurriculumLevel('queen-3');
const sacrifices = Array.from({ length: 8 }, (_, i) => quiet(`sac-${i}`, 1100, ['sacrifice']));
assert.deepEqual(themesOf(selectLevelExercises([...sacrifices, quiet('defender-0', 1100, ['capturingDefender'])], queen3, 1100)), { sacrifice: 7, capturingDefender: 1 }, 'without queen sacrifices any sacrifice fills in');

for (const locale of ['en', 'bg']) {
    const messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../messages/${locale}.json`), 'utf8'));
    for (const theme of rules.EXERCISE_THEMES) {
        assert.ok(messages.LevelExercises[`goal_${theme}`], `${locale} goal for ${theme}`);
        assert.ok(messages.LevelExercises[`explain_${theme}`], `${locale} explanation for ${theme}`);
    }
    for (const piece of 'pnbrqk') assert.ok(messages.LevelExercises[`piece_${piece}`]);
}
console.log('Level exercises passed: beginner capture safety, theme/difficulty limits, retries, scoring, manual replies and solution review.');

// Optional read-only audit of the exact production pool, without user sessions.
if (process.env.AUDIT_LEVEL_POOLS === '1') {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    (async () => {
        const missing = [];
        for (const level of [...curriculum.CURRICULUM, curriculum.KING_LEVEL]) {
            if (beginnerExercises(level.id)) continue;
            const range = rules.levelRatingRange(level.startRating);
            const pool = await prisma.puzzle.findMany({
                where: { rating: { gte: range.min, lte: range.max }, ...(level.tags.length ? { tags: { hasSome: level.tags } } : {}) },
                select: { id: true, fen: true, solution: true, rating: true, tags: true },
                take: level.only || level.mix ? 4000 : 400,
            });
            const chosen = selectLevelExercises(pool, level, level.startRating);
            console.log(`${level.id}: ${chosen.length}/8 valid exercises in ${range.min}-${range.max}; ${pool.length} candidates`);
            if (chosen.length !== 8) missing.push(level.id);
        }
        assert.deepEqual(missing, [], 'every level needs a complete pool at its lesson difficulty');
    })().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
