/* eslint-disable @typescript-eslint/no-require-imports -- Test learning rules and data access without a database. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const { Chess } = require('chess.js');

function loadSource(relative, overrides = {}) {
    const filename = path.resolve(__dirname, relative);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const mod = new Module(filename, module);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : name.startsWith('./') ? loadSource(path.relative(__dirname, path.resolve(path.dirname(filename), `${name}.ts`)), overrides) : original(name);
    mod._compile(code, filename);
    return mod.exports;
}
const { MICRO_LESSONS, lessonAnswer, lessonForLevel } = loadSource('../src/lib/microLessons.ts');
const { moveClue, consequencePosition } = loadSource('../src/lib/puzzleLearning.ts');
const { puzzleReviewState, selectPuzzleReviews } = loadSource('../src/lib/puzzleReview.ts');
const at = (day, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+03:00`);
const attempt = (success, day, puzzleId = 'p1', hour) => ({ success, createdAt: at(day, hour), puzzleId });

for (const [id, lesson] of Object.entries(MICRO_LESSONS)) {
    test(`${id}: example and fresh challenge are legal and teach the promised property`, () => {
        const demo = new Chess(lesson.fen);
        assert(!demo.inCheck(), 'beginner example starts out of check');
        demo.move({from: lesson.move.slice(0, 2), to: lesson.move.slice(2, 4)});
        assert(lessonAnswer(id, lesson.answer));
        assert(!lessonAnswer(id, 'a1a8q'));
        assert.notEqual(lesson.fen, lesson.challenge);
        if (id === 'checkmate') assert(demo.isCheckmate());
        if (id === 'fork') for (const target of lesson.targets) assert(demo.attackers(target, 'w').includes('f7'));
        if (id === 'pin') assert.equal(demo.moves({square:'d7'}).length, 0, 'pinned knight cannot legally move');
        if (id === 'safeCapture') assert(!demo.isAttacked('a5', 'b'));
        if (id === 'defend') assert(!demo.isAttacked('b1', 'b'));
    });
}
test('defense accepts other safe rook squares, but not a move still on the attacked file', () => {
    assert(lessonAnswer('defend', 'c1e1'));
    assert(!lessonAnswer('defend', 'c1c2'));
    assert.equal(lessonForLevel('pawn-3'), 'defend');
    assert.equal(lessonForLevel('bishop-1'), 'pin');
    assert.equal(lessonForLevel('queen-3'), null);
});
test('clues verify captures, checks, mate and promotions and handle SAN', () => {
    assert.equal(moveClue(MICRO_LESSONS.safeCapture.fen, 'Rxa5').clue, 'capture');
    assert.equal(moveClue(MICRO_LESSONS.fork.fen, 'e5f7').clue, 'check');
    assert.equal(moveClue(MICRO_LESSONS.checkmate.fen, 'f7g7').clue, 'mate');
    assert.equal(moveClue('6k1/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n').clue, 'promotion');
    assert.equal(moveClue(MICRO_LESSONS.pin.fen, 'c4b5').clue, 'think');
    assert.equal(moveClue(new Chess().fen(), 'e2e8'), null);
});
test('consequences apply the actual alternative and legal reply, without treating every reply as a loss', () => {
    const board = new Chess();
    board.move('e4');
    board.move('e5');
    const quiet = consequencePosition(board.fen(), 'g1f3', 'b8c6');
    assert.equal(quiet.reply, 'Nc6');
    assert.equal(quiet.reason, 'possibleReply');
    const capture = consequencePosition(MICRO_LESSONS.defend.fen, 'a1a2', 'a8a2');
    assert.equal(capture.captured, 'r');
    assert.equal(capture.reason, 'captureReply');
    assert.throws(() => consequencePosition(board.fen(), 'g1f3', 'a1a8'));
});
test('successful puzzles alone never enter the review queue; failures first return tomorrow', () => {
    assert.equal(puzzleReviewState([attempt(true, '2026-10-18')]), null);
    const history = [attempt(false, '2026-10-19')];
    assert.equal(selectPuzzleReviews(history, at('2026-10-19')).length, 0);
    assert.equal(selectPuzzleReviews(history, at('2026-10-20'))[0].puzzleId, 'p1');
});
test('same-day retries never erase failure or build memory, regardless of input order', () => {
    const history = [attempt(false, '2026-10-15', 'p1', 10), attempt(true, '2026-10-15', 'p1', 12), attempt(true, '2026-10-15', 'p1', 13)];
    const expected = {level:0,dueOn:'2026-10-16'};
    assert.deepEqual(puzzleReviewState(history), expected);
    assert.deepEqual(puzzleReviewState([...history].reverse()), expected);
});
test('independent successes on due days expand intervals and early retries do not postpone review', () => {
    const history = [attempt(false, '2026-10-01'), attempt(true, '2026-10-02'), attempt(true, '2026-10-03')];
    assert.deepEqual(puzzleReviewState(history), {level:1,dueOn:'2026-10-05'});
    history.push(attempt(true, '2026-10-05'));
    assert.deepEqual(puzzleReviewState(history), {level:2,dueOn:'2026-10-12'});
    history.push(attempt(false, '2026-10-10'));
    assert.deepEqual(puzzleReviewState(history), {level:0,dueOn:'2026-10-11'});
});
test('daily selection is capped at three and remains stable after results and reloads', () => {
    const before = ['p1','p2','p3','p4'].map(id => attempt(false, '2026-10-18', id));
    const first = selectPuzzleReviews(before, at('2026-10-19'));
    const after = selectPuzzleReviews([...before, attempt(true, '2026-10-19', 'p1'), attempt(false, '2026-10-19', 'p2')], at('2026-10-19'));
    assert.equal(first.length,3);
    assert.deepEqual(after.map(item=>item.puzzleId),first.map(item=>item.puzzleId));
    assert.deepEqual(after.map(item=>item.done),[true,true,false]);
});
test('day boundaries follow Sofia including a UTC date change', () => {
    const history = [{puzzleId:'p1',success:false,createdAt:new Date('2026-10-18T21:30:00Z')}];
    assert.equal(selectPuzzleReviews(history,new Date('2026-10-19T10:00:00Z')).length,0);
    assert.equal(selectPuzzleReviews(history,new Date('2026-10-20T10:00:00Z')).length,1);
});
test('review loading isolates the student, orders the selected rows and chooses unseen transfer examples', async () => {
    const calls = [];
    const service = loadSource('../src/lib/puzzleReviewService.ts', { './db': {prisma: {
        puzzleAttempt: { findMany: async args => {
            calls.push(args);
            assert.equal(args.where.userId, 'child');
            return args.distinct ? [{puzzleId:'p1'}] : [attempt(false,'2026-10-18')];
        } },
        puzzle: { findMany: async args => {
            calls.push(args);
            if (args.where.attempts) {
                assert.deepEqual(args.where.attempts,{none:{userId:'child'}});
                assert.equal(args.where.tags.has,'fork');
                return [{id:'p2', name:'new',fen:MICRO_LESSONS.fork.fen,solution:'e5f7',tags:['fork'],rating:600,hints:null}];
            }
            return [{id:'p1',name:'old',fen:MICRO_LESSONS.fork.fen,solution:'e5f7',tags:['middlegame','fork'],rating:650,hints:['note',7]}];
        } },
    } } });
    const review = await service.loadPuzzleReviews('child', at('2026-10-19'));
    assert.equal(review.target,1);
    assert.equal(review.done,0);
    assert.deepEqual(review.items[0].hints,['note','']);
    const transfer = await service.loadReviewTransfer('child',review.items);
    assert.equal(transfer[0].fresh,true);
    assert.equal(transfer[0].afterPuzzleId,'p1');
    assert.equal(calls.length,4);
});

test('each transfer example matches the position it follows and excludes earlier selections', async () => {
    const calls=[];
    const service=loadSource('../src/lib/puzzleReviewService.ts',{'./db':{prisma:{puzzle:{findMany:async args=>{
        calls.push(args);
        const id=`fresh-${calls.length}`;
        return [{id,name:id,fen:MICRO_LESSONS.fork.fen,solution:'e5f7',hints:null,tags:[args.where.tags.has],rating:600}];
    }}}}});
    const base={fen:MICRO_LESSONS.fork.fen,solution:'e5f7',hints:[],fresh:false,rating:600};
    const transfer=await service.loadReviewTransfer('child',[{...base,id:'fork',name:'fork',tags:['fork']},{...base,id:'mate',name:'mate',tags:['mateIn1']}]);
    assert.deepEqual(transfer.map(item=>[item.afterPuzzleId,item.tags[0]]),[['fork','fork'],['mate','mateIn1']]);
    assert(calls[1].where.id.notIn.includes('fresh-1'));
    assert.equal(calls[0].take,1);
});
