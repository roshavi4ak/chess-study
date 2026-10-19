/* eslint-disable @typescript-eslint/no-require-imports -- Test chess rules and worker lifetimes without a database. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const { Chess } = require('chess.js');
function loadSource(relative) {
    const filename = path.resolve(__dirname,relative);
    const mod = new Module(filename,module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original=mod.require.bind(mod);
    mod.require=name=>name.startsWith('./') && !name.endsWith('.json')?loadSource(path.relative(__dirname,path.resolve(path.dirname(filename),`${name}.ts`))):original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
    return mod.exports;
}
const teaching=loadSource('../src/lib/chessTeaching.ts');
const {learningMove}=loadSource('../src/lib/puzzleLearning.ts');
const defense=loadSource('../src/lib/defenseTraining.ts');
const endgames=loadSource('../src/lib/endgameTraining.ts');
for(const position of defense.DEFENSE_POSITIONS) test(`${position.id}: a real threat, a valid defense and a legal refutation`,()=>{
    const start=defense.defenseStart(position);
    assert(!new Chess(start.fen).inCheck(),'identify a piece threat, not an unanswered king check');
    const threats=teaching.captureThreats(start.fen,'w');
    assert.equal(threats.length,1);
    assert.equal(threats[0].square,position.target);
    assert.equal(defense.defenseAnswer(position,position.safe)?.correct,true,'authored safe answer is sound');
    const result=defense.defenseAnswer(position,position.tempting);
    assert(result,'tempting move is legal');
    assert.equal(result.correct,false);
    assert(result.reply);
    const continuation=new Chess(start.fen);learningMove(continuation,position.tempting);learningMove(continuation,result.reply);
});
test('short rounds cover every authored position over four rounds',()=>{
    assert.equal(defense.DEFENSE_POSITIONS.length,20);
    const ids=new Set();
    for(let round=0;round<4;round++) {
        const positions=defense.defenseRound(round);
        assert.equal(positions.length,5);
        assert.equal(new Set(positions.map(p=>p.theme)).size,5);
        positions.forEach(p=>ids.add(p.id));
    }
    assert.equal(ids.size,20);
});
test('a defense accepts different safe squares, blocking and capturing the attacker',()=>{
    const p=defense.DEFENSE_POSITIONS[0];
    for(const answer of ['b2c2','b2d2','b2b8']) assert.equal(defense.defenseAnswer(p,answer)?.correct,true,answer);
    assert.equal(defense.defenseAnswer(p,'b2b3')?.correct,false);
});
test('a pinned attacker is not an immediate capture threat and equal exchanges are not called material loss',()=>{
    assert.equal(teaching.captureThreats('4k3/4b3/5Q2/8/8/8/8/4R2K w - - 0 1','w').length,0);
    assert.equal(teaching.captureThreats('3r3k/8/8/8/3R4/2K5/8/8 w - - 0 1','w').length,0);
});
test('coaching identifies development, castling and legal danger without blocking a mating move',()=>{
    const initial=new Chess();assert.equal(teaching.coachingPraise(initial.fen(),'g1f3'),'developPraise');
    assert.equal(teaching.coachingHint(initial.fen()).clue,'developClue');
    assert.equal(teaching.coachingPraise('r3k2r/ppp2ppp/2n5/8/8/8/PPP2PPP/R3K2R w KQkq - 0 1','e1g1'),'castlePraise');
    const bad=defense.DEFENSE_POSITIONS[0];assert(teaching.moveWarning(defense.defenseStart(bad).fen,bad.tempting));
    assert.equal(teaching.moveWarning('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1','f7g7'),null);
    const exchange=new Chess();exchange.move('e4');exchange.move('d5');
    assert.equal(teaching.moveWarning(exchange.fen(),'e4d5'),null,'a capture followed by an equal recapture is not material loss');
});
for(const challenge of endgames.ENDGAMES) test(`${challenge.id}: valid live positions and an accurate demonstration`,()=>{
    for(const mirror of [false,true]) {
        const game=new Chess(endgames.endgameFen(challenge,mirror));
        assert(!game.isGameOver());
        assert.equal(endgames.endgameOutcome(game,challenge.goal,'w'),null);
    }
    const example=new Chess(challenge.demoFen);challenge.demo.forEach(move=>learningMove(example,move));
    if(challenge.goal==='mate') assert(example.isCheckmate());
    if(challenge.goal==='promotion') assert(example.history({verbose:true}).at(-1).promotion);
    if(challenge.goal==='draw') assert(example.isStalemate());
});
test('cloning preserves repetition and endgame completion does not reward stalemate in a mate task',()=>{
    const game=new Chess();for(let i=0;i<2;i++) for(const move of ['Nf3','Nf6','Ng1','Ng8'])game.move(move);
    assert(game.isThreefoldRepetition());assert(teaching.copyGame(game).isThreefoldRepetition());
    const draw=endgames.ENDGAMES.find(c=>c.id==='holdDraw');const board=new Chess(draw.demoFen);draw.demo.forEach(move=>learningMove(board,move));
    assert.equal(endgames.endgameOutcome(board,'draw','w'),'won');
    assert.equal(endgames.endgameOutcome(board,'mate','w'),'stalemate');
});
test('engine requests wait for readiness, validate replies and terminate after completion/cancellation',async()=>{
    const {trainingMove}=loadSource('../src/lib/trainingEngine.ts');const original=globalThis.Worker;const workers=[];
    globalThis.Worker=class {constructor(){workers.push(this);this.messages=[];this.terminated=false;}postMessage(m){this.messages.push(m);}terminate(){this.terminated=true;}};
    try {
        const first=new AbortController();const result=trainingMove(new Chess().fen(),first.signal,5,2000,3);const worker=workers[0];
        assert.deepEqual(worker.messages,['uci']);worker.onmessage({data:'uciok'});worker.onmessage({data:'readyok'});
        assert(worker.messages.includes('setoption name Skill Level value 3'));assert(worker.messages.includes('go depth 5'));
        worker.onmessage({data:'bestmove e2e4'});assert.equal(await result,'e2e4');assert(worker.terminated);
        const second=new AbortController();const cancelled=trainingMove(new Chess().fen(),second.signal);second.abort();assert.equal(await cancelled,null);assert(workers[1].terminated);
        const third=new AbortController();const invalid=trainingMove(new Chess().fen(),third.signal);workers[2].onmessage({data:'bestmove e2e8'});assert.equal(await invalid,null);assert(workers[2].terminated);
    } finally {globalThis.Worker=original;}
});

const advanced=loadSource('../src/lib/defensePuzzles.ts');
const fixtures=require('./fixtures/defense-puzzles.json');
for(const group of fixtures) test(`defense level ${group.level}: five real uploaded puzzles fit the band and play legally to the student's final reply`,()=>{
    assert.equal(group.puzzles.length,5);
    const band=advanced.DEFENSE_LEVELS[group.level-1];
    for(const row of group.puzzles) {
        const puzzle=advanced.prepareDefensePuzzle(row,group.level);assert(puzzle);
        assert(Math.ceil(puzzle.moves.length/2)>=band.replies);
        assert(puzzle.rating>=band.min&&puzzle.rating<band.max);
        const game=new Chess(puzzle.fen);learningMove(game,puzzle.setup);
        assert.equal(game.turn(),puzzle.side);
        puzzle.moves.forEach(move=>learningMove(game,move));
        assert.notEqual(game.turn(),puzzle.side);
    }
});
test('defensive selection rejects malformed, off-topic and wrong-band data',()=>{
    const row=fixtures[0].puzzles[0];
    assert.equal(advanced.prepareDefensePuzzle({...row,tags:['fork']},2),null);
    assert.equal(advanced.prepareDefensePuzzle({...row,solution:'a1a8 a8a1'},2),null);
    assert.equal(advanced.prepareDefensePuzzle(row,10),null);
    assert.equal(advanced.prepareDefensePuzzle(row,1),null);
    assert.equal(advanced.DEFENSE_LEVELS.length,10);
});
test('alternative defense comparison uses the opponent perspective and preserves forced mates',()=>{
    const cp=value=>({score:{type:'cp',value},pv:[]}),mate=value=>({score:{type:'mate',value},pv:[]});
    assert(advanced.equivalentDefense(cp(0),cp(-200)));
    assert(!advanced.equivalentDefense(cp(0),cp(200)));
    assert(advanced.equivalentDefense(mate(-4),mate(-9)));
    assert(!advanced.equivalentDefense(mate(-4),cp(-500)));
    assert(!advanced.equivalentDefense(cp(0),mate(3)));
});
const starts=require('../src/lib/endgameStarts.json');
const kingDistance=(a,b)=>Math.max(Math.abs(a.charCodeAt(0)-b.charCodeAt(0)),Math.abs(Number(a[1])-Number(b[1])));
for(const challenge of endgames.ENDGAMES) test(`${challenge.id}: varied legal verified starts, safe pawn support, and no immediate repeats`,()=>{
    const pool=starts.positions[challenge.id];assert(pool.length>=40);
    for(const row of pool) {
        assert.equal(row.category,challenge.goal==='draw'?'draw':'win');
        const game=new Chess(row.fen);assert(!game.isGameOver());assert(!game.inCheck());
        const pieces=game.board().flat().filter(Boolean),white=pieces.find(p=>p.type==='k'&&p.color==='w'),black=pieces.find(p=>p.type==='k'&&p.color==='b');
        assert(kingDistance(white.square,black.square)>1);assert(!game.isAttacked(black.square,'w'));
        if(challenge.goal==='promotion') {
            const pawn=pieces.find(p=>p.type==='p');assert.equal(pawn.color,'w');
            assert(kingDistance(white.square,pawn.square)<kingDistance(black.square,pawn.square));
        }
        if(challenge.id==='bishopPairMate') {
            const bishops=pieces.filter(p=>p.type==='b');assert.equal(bishops.length,2);
            const color=s=>(s.charCodeAt(0)+Number(s[1]))%2;
            assert.notEqual(color(bishops[0].square),color(bishops[1].square));
        }
    }
    let previous;const unique=new Set();let seed=17;
    const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    for(let i=0;i<80;i++) {
        const fen=endgames.randomEndgameFen(challenge,previous,random);assert.notEqual(fen,previous);
        const game=new Chess(fen);assert(!game.isGameOver());assert(!game.inCheck());
        if(challenge.goal==='promotion') {
            const p=game.board().flat().filter(Boolean);const pawn=p.find(x=>x.type==='p'),king=c=>p.find(x=>x.type==='k'&&x.color===c);
            assert(kingDistance(king('w').square,pawn.square)<kingDistance(king('b').square,pawn.square));
        }
        unique.add(fen);previous=fen;
    }
    assert(unique.size>20);
    const first=endgames.randomEndgameFen(challenge,undefined,()=>0);
    assert.notEqual(endgames.randomEndgameFen(challenge,first,()=>0),first);
});
test('analysis reports only a legal principal variation and cancels owned workers',async()=>{
    const {trainingAnalysis}=loadSource('../src/lib/trainingEngine.ts');const original=globalThis.Worker;const workers=[];
    globalThis.Worker=class {constructor(){workers.push(this);}postMessage(){}terminate(){this.terminated=true;}};
    try {
        const request=trainingAnalysis(new Chess().fen(),new AbortController().signal);const worker=workers[0];
        worker.onmessage({data:'info depth 14 score cp 24 pv e2e4 e7e5'});
        worker.onmessage({data:'info depth 14 score cp 90 lowerbound pv e2e4'});
        worker.onmessage({data:'bestmove e2e4'});
        assert.deepEqual(await request,{score:{type:'cp',value:24},pv:['e2e4','e7e5']});assert(worker.terminated);
        const controller=new AbortController();const pending=trainingAnalysis(new Chess().fen(),controller.signal);controller.abort();assert.equal(await pending,null);assert(workers[1].terminated);
    } finally {globalThis.Worker=original;}
});
test('endgame advisor validates positions and shares/caches outcome metadata with an upstream request',async()=>{
    const {tablebaseMove,tablebaseAdvice,validTrainingEndgame}=loadSource('../src/lib/endgameTablebase.ts');const original=globalThis.fetch;let count=0;
    const fen=starts.positions.bishopKnightMate[0].fen,game=new Chess(fen);const move=teaching.moveUci(game.moves({verbose:true})[0]);
    globalThis.fetch=async()=>{count++;return{ok:true,status:200,json:async()=>({category:'win',dtm:21,moves:[{uci:move}]})};};
    try {
        assert(!validTrainingEndgame(new Chess().fen()));assert(!validTrainingEndgame('not a position'));
        const results=await Promise.all([tablebaseMove(fen),tablebaseMove(fen)]);assert.deepEqual(results,[move,move]);assert.equal(count,1);
        assert.equal(await tablebaseMove(fen),move);assert.equal(count,1);
        assert.deepEqual(await tablebaseAdvice(fen),{move,category:'win',dtm:21});assert.equal(count,1);
        await assert.rejects(tablebaseMove(new Chess().fen()));
    } finally {globalThis.fetch=original;}
});

const lessons=loadSource('../src/lib/endgameLessons.ts').ENDGAME_LESSONS;
const hintRules=loadSource('../src/lib/endgameHints.ts');
const lessonProof=require('../docs/endgame-tutorial-verification-2026-10-19.json');
for(const challenge of endgames.ENDGAMES) test(`${challenge.id}: strategy tutorial examples are legal and teach accurate terminal results`,()=>{
    const steps=lessons[challenge.id];assert(steps.length>=3);
    for(const step of steps) {
        const game=new Chess(step.fen);assert(!game.isGameOver(),step.id);
        const pieces=game.board().flat().filter(Boolean),other=game.turn()==='w'?'b':'w';
        assert(!game.isAttacked(pieces.find(p=>p.type==='k'&&p.color===other).square,game.turn()),step.id+': last mover did not leave its king in check');
        for(const move of step.moves) learningMove(game,move);
        if(['mate','net'].includes(step.id)) assert(game.isCheckmate(),step.id);
        if(step.id==='stalemate') assert(game.isStalemate(),step.id);
        if(step.id==='promote') assert(game.history({verbose:true}).at(-1).promotion,step.id);
        if(step.id==='capture'||step.id==='rush') assert(game.isInsufficientMaterial(),step.id);
    }
});
for(const [id,steps]of Object.entries(lessons)) {
    test(`${id}: no displayed board leaves material capturable by the defending king`,()=>{
        for(const step of steps) {
            const game=new Chess(step.fen);
            for(let ply=0;ply<=step.moves.length;ply++) {
                // Inspect White-to-move snapshots too, so an unexplained hanging
                // piece cannot be hidden by the next authored move saving it.
                const fen=game.fen().split(' ');fen[1]='b';fen[3]='-';
                const captures=new Chess(fen.join(' ')).moves({verbose:true}).filter(move=>move.captured);
                const expected=id==='promotion'&&step.id==='rush'&&ply===1?['e6e5']:[];
                assert.deepEqual(captures.map(move=>move.from+move.to).sort(),expected,`${step.id} ply ${ply}: unexplained capture`);
                if(ply<step.moves.length)learningMove(game,step.moves[ply]);
            }
        }
    });
    test(`${id}: every intermediate board preserves the stated result against every legal defense`,()=>{
        for(const step of steps) {
            const proof=lessonProof.examples.find(row=>row.challenge===id&&row.step===step.id);
            assert(proof,`Missing proof: ${step.id}; run scripts/verify-endgame-lessons.cjs`);
            assert.deepEqual(proof.moves,step.moves);
            assert.equal(proof.positions.length,step.moves.length+1);
            const game=new Chess(step.fen);
            for(let ply=0;ply<=step.moves.length;ply++) {
                const position=proof.positions[ply];
                assert.equal(position.fen,game.fen(),`${step.id} ply ${ply}: stale tablebase evidence`);
                const expected=id==='holdDraw'||step.id==='rush'||(step.id==='stalemate'&&ply>0)?'draw':'win';
                const result=position.category==='draw'?'draw':(position.category==='win')===(game.turn()==='w')?'win':'loss';
                assert.equal(result,expected,`${step.id} ply ${ply}`);
                assert.deepEqual(position.moves.map(move=>move.uci).sort(),game.moves({verbose:true}).map(move=>move.from+move.to+(move.promotion||'')).sort());
                if(game.turn()==='b') for(const alternative of position.moves) {
                    // Child categories use White's perspective after Black moves.
                    assert(id==='holdDraw'?alternative.category!=='loss':alternative.category===expected,`${step.id}: Black can improve with ${alternative.uci}`);
                }
                if(ply<step.moves.length)learningMove(game,step.moves[ply]);
            }
        }
    });
}
test('tablebase evidence covers exactly the current tutorial collection',()=>{
    assert.equal(lessonProof.examples.length,Object.values(lessons).reduce((sum,steps)=>sum+steps.length,0));
    const keys=lessonProof.examples.map(row=>row.challenge+'/'+row.step);
    assert.equal(new Set(keys).size,keys.length);
});

test('endgame hints explain actual king, pawn, mating and drawing effects instead of assigning a generic motif',()=>{
    const h=hintRules.endgameHintContext;
    assert.equal(h('rookMate',endgames.ENDGAMES[1].fen,'f5g6').reason,'kingApproach');
    assert.equal(h('queenMate','7k/8/5K2/8/4Q3/8/8/8 w - - 0 1','f6e5').reason,'kingWall');
    assert.equal(h('queenMate','7k/5Q2/6K1/8/8/8/8/8 w - - 0 1','f7g7').reason,'mate');
    assert.equal(h('queenMate','7k/4Q3/6K1/8/8/8/8/8 w - - 0 1','e7f7').reason,'stalemate');
    assert.equal(h('promotion','8/k7/8/4K3/8/4P3/8/8 w - - 0 1','e3e4').reason,'supportedPawn');
    assert.equal(h('promotion','8/k7/8/8/5K2/4P3/8/8 w - - 0 1','f4e5').reason,'keySquare');
    assert.equal(h('opposition','8/8/4k3/8/3K4/4P3/8/8 w - - 0 1','d4e4').reason,'opposition');
    assert.notEqual(h('opposition','8/8/4k3/4P3/3K4/8/8/8 w - - 0 1','d4e4').reason,'opposition','a pawn between the kings is not an empty opposition square');
    assert.equal(h('holdDraw','8/8/8/8/7k/7p/5K2/8 w - - 0 1','f2g1').reason,'approachCorner');
    assert.equal(h('holdDraw','8/8/8/8/6k1/8/7p/7K w - - 0 1','h1h2').reason,'drawCapture');
    const knight=h('bishopKnightMate',lessons.bishopKnightMate[0].fen,'f7e5');assert.equal(knight.color,'light');assert.deepEqual(knight.focus,['a8','h1']);
    assert.equal(h('bishopKnightMate','k7/8/N5K1/8/2B5/8/8/8 w - - 0 1','a6c5').plan,'bishopKnightCorner','recognize a king already in the correct-coloured corner');
    assert.equal(h('rookMate','invalid','a1a8'),null);
    assert.equal(hintRules.squareColor('a1'),'dark');assert.equal(hintRules.squareColor('h8'),'dark');
    assert.deepEqual(hintRules.pawnKeySquares('e3'),['d5','e5','f5']);assert.deepEqual(hintRules.pawnKeySquares('e5'),['d6','e6','f6']);assert.deepEqual(hintRules.pawnKeySquares('a4'),[]);
    const rook=h('rookMate',endgames.ENDGAMES[1].fen,'f5g6');assert.equal(rook.values.before,3);assert.equal(rook.values.after,1);
});
test('all tutorial steps and hint explanations have complete English and Bulgarian content',()=>{
    const english=require('../messages/en.json'),bulgarian=require('../messages/bg.json');
    const leaves=(obj,prefix='')=>Object.entries(obj).flatMap(([key,value])=>typeof value==='string'?[prefix+key]:leaves(value,prefix+key+'.')).sort();
    assert.deepEqual(leaves(english.EndgameLessons),leaves(bulgarian.EndgameLessons));
    assert.deepEqual(leaves(english.EndgameHints),leaves(bulgarian.EndgameHints));
    for(const messages of [english,bulgarian])for(const [id,steps]of Object.entries(lessons)) {
        for(const step of steps)for(const field of ['title','explain','after'])assert(messages.EndgameLessons[id][step.id][field].trim().length>10);
        for(const field of ['check1','check2','check3','trap'])assert(messages.EndgameLessons[id][field].trim().length>10);
    }
});
