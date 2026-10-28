/* eslint-disable @typescript-eslint/no-require-imports -- Real activity components with simulated BLE, engines and Lichess boundaries. */
const { test, beforeEach, afterEach } = require('node:test');
process.env.DEBUG_PRINT_LIMIT = '1800';
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost/en/play' });
for (const key of ['window','self','document','navigator','HTMLElement','Node','Event']) Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.isSecureContext = true;
const React = require('react');
const { render, screen, fireEvent, waitFor, act, cleanup } = require('@testing-library/react');
const { NextIntlClientProvider } = require('next-intl');
const { Chess } = require('chess.js');
const { sourceLoader, fakeBoard } = require('./test-support/chessnut.cjs');
const messages = require('../messages/en.json');
let peripheral, saves, fetches, engineRequests, stream, moves, botReply, ladder;
const originalFetch = globalThis.fetch;
const boundaries = {
    'react-chessboard': { Chessboard: ({options}) => React.createElement('div',{'data-testid':options.id,'data-position':typeof options.position==='string'?options.position:JSON.stringify(options.position),'data-draggable':String(options.allowDragging)}) },
    'next/image': ({src,alt}) => React.createElement('img',{src,alt}),
    'next-auth/react': { useSession: () => ({data:{user:{id:'student'}},status:'authenticated'}) },
    '@/i18n/navigation': { Link: ({children,href}) => React.createElement('a',{href},children) },
    '@/app/actions/play': { recordPlaySession: async data => {saves.push(data);}, getPersonalBests:async()=>({byKey:{}}),getPuzzleLadder:async()=>ladder },
    '@/app/actions/users': { getAvailableUsers: async()=>[] },
    '@/app/actions/lichess': { getLichessAccessToken:async()=>'test-token',getCurrentUserLichessId:async()=>'student' },
    '@/lib/botEngine': { chooseBotMove: fen => botReply(fen) },
    '@/lib/endgameClient': { endgameMove:(fen,signal)=>new Promise(resolve=>engineRequests.push({fen,signal,resolve})),endgameAdvice:async()=>null },
    '@/lib/lichessService': {
        createLichessAIChallenge:async()=>'test-game',streamLichessGame:(_token,_id,_me,callback)=>{stream=callback;return()=>{};},streamLichessEvents:()=>()=>{},
        makeLichessMove:(_token,id,move)=>new Promise(resolve=>moves.push({id,move,resolve})),
        createLichessUserChallenge:async()=>({accepted:false}),acceptLichessChallenge:async()=>true,declineLichessChallenge:async()=>true,resignLichessGame:async()=>true,offerLichessDraw:async()=>true,
    },
};
const load = sourceLoader(boundaries);
const BotGame = load('src/components/BotGame.tsx').default;
const EndgameTrainer = load('src/components/EndgameTrainer.tsx').default;
const LevelExerciseBoard = load('src/components/LevelExerciseBoard.tsx').default;
const MicroLesson = load('src/components/MicroLesson.tsx').default;
const MiniBoardGame = load('src/components/MiniBoardGame.tsx').default;
const PawnWarsGame = load('src/components/PawnWarsGame.tsx').default;
const MiniPuzzleGame = load('src/components/MiniPuzzleGame.tsx').default;
const PlayPage = load('src/app/[locale]/play/page.tsx').default;
const { ChessnutSession } = load('src/components/ChessnutSession.tsx');
const { WORLDS } = load('src/lib/miniGames.ts');
const { MICRO_LESSONS } = load('src/lib/microLessons.ts');
const start = new Chess().fen();
const bot = {id:'sloth',avatar:'Sloth.png',policy:{randomChance:1,lookahead:0,captureWeight:0,style:'none'},takebacks:true};
const wrap = child => React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'Europe/Sofia'},child);
const mount = (component,props) => render(wrap(React.createElement(component,props)));
const pause = async ms => act(async()=>{await new Promise(resolve=>setTimeout(resolve,ms));});
const settle = () => pause(360);
const report = async fen => {await act(async()=>peripheral.notify(fen));await settle();};
async function connect() {await waitFor(()=>assert(screen.getByRole('button',{name:messages.Chessnut.connect})));await act(async()=>fireEvent.click(screen.getByRole('button',{name:messages.Chessnut.connect})));await settle();}
const play = (fen,uci) => {const game=new Chess(fen);game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});return game.fen();};
const position = id => screen.getByTestId(id).getAttribute('data-position');
beforeEach(()=>{
    peripheral=fakeBoard();saves=[];fetches=[];engineRequests=[];moves=[];stream=null;ladder=[];
    botReply=fen=>new Chess(fen).turn()==='b'?'e7e5':'e2e4';
    Object.defineProperty(navigator,'bluetooth',{configurable:true,value:peripheral.bluetooth});
    globalThis.fetch=async(url,options)=>{fetches.push({url,options});return{ok:true,json:async()=>({})};};
});
afterEach(async()=>{await act(async()=>cleanup());globalThis.fetch=originalFetch;});

test('animal bot replies must be placed before another student move is accepted', async()=>{
    mount(BotGame,{bot,childColor:'w',initialTeaching:false,onFinish:()=>{}});
    await connect();const e4=play(start,'e2e4'),e5=play(e4,'e7e5');
    await report(e4);await waitFor(()=>assert.equal(position('bot-game'),e5),{timeout:2500});
    assert.equal(position('bot-game'),e5);
    await report(play(e4.replace(' b ', ' w '),'g1f3'));
    assert.equal(position('bot-game'),e5);
    await report(e5);
    botReply=()=> 'b8c6';
    await report(play(e5,'g1f3'));
    assert.equal(new Chess(position('bot-game')).get('f3').type,'n');
});

test('bot game completion is recorded only after the final opponent piece is placed',async()=>{
    const finished=[];botReply=fen=>new Chess(fen).get('e7')?'e7e5':'d8h4';
    mount(BotGame,{bot,childColor:'w',initialTeaching:false,onFinish:(...args)=>finished.push(args)});
    await connect();const f3=play(start,'f2f3'),e5=play(f3,'e7e5'),g4=play(e5,'g2g4'),mate=play(g4,'d8h4');
    await report(f3);await waitFor(()=>assert.equal(position('bot-game'),e5),{timeout:2500});await report(e5);await report(g4);
    await waitFor(()=>assert(new Chess(position('bot-game')).isCheckmate()),{timeout:2500});
    assert(new Chess(position('bot-game')).isCheckmate());assert.equal(finished.length,0);
    await report(mate);await waitFor(()=>assert.equal(finished.length,1));
    assert.equal(finished[0][0],'loss');
    await report(mate);assert.equal(finished.length,1);
});

test('a student playing Black must place the animal bot opening move before replying',async()=>{
    mount(BotGame,{bot,childColor:'b',initialTeaching:false,onFinish:()=>{}});
    await connect();const e4=play(start,'e2e4'),e5=play(e4,'e7e5');
    await waitFor(()=>assert.equal(position('bot-game'),e4),{timeout:2500});
    await report(e4);await report(e5);
    assert.equal(new Chess(position('bot-game')).get('e5').type,'p');
});

test('endgame input follows the computer and records a real physical mate',async()=>{
    const fen='7k/8/8/5K2/8/8/8/R7 w - - 0 1';peripheral.notify(fen);
    mount(EndgameTrainer,{initialFen:fen});
    fireEvent.click(screen.getByRole('button',{name:messages.EndgameLessons.try}));
    await connect();const king=play(fen,'f5g6');await report(king);
    await waitFor(()=>assert.equal(engineRequests.length,1));
    await act(async()=>engineRequests[0].resolve('h8g8'));
    const reply=play(king,'h8g8');assert.equal(saves.length,0);
    await report(reply);await report(play(reply,'a1a8'));
    await waitFor(()=>assert.equal(saves.length,1));assert.equal(saves[0].key,'endgame:queenMate');assert.equal(saves[0].won,true);
});

test('beginner exercises reject a wrong physical move, resume after correction and save success once',async()=>{
    const fen='7k/8/8/n7/8/8/8/R6K w - - 0 1';peripheral.notify(fen);
    mount(LevelExerciseBoard,{exercise:{id:'capture',puzzleId:'puzzle1',theme:'hangingPiece',fen,moves:['a1a5']},last:false,onContinue:()=>{}});
    await connect();await report(play(fen,'a1a2'));
    assert(screen.getByText(messages.Chessnut.restore));
    await report(fen);await pause(50);await report(play(fen,'a1a5'));
    await waitFor(()=>assert(screen.getByRole('button',{name:messages.LevelExercises.nextExercise})));
    assert.equal(fetches.length,1,'review history records one assisted/failed attempt, never a second clean success');
    assert.equal(JSON.parse(fetches[0].options.body).success,false);
});

test('a beginner lesson supports identifying a piece by lifting and replacing it',async()=>{
    const lesson=MICRO_LESSONS.safeCapture;peripheral.notify(lesson.fen);
    mount(MicroLesson,{lessonId:'safeCapture',onPractice:()=>{}});await connect();
    fireEvent.click(screen.getByRole('button',{name:messages.MicroLessons.showExample}));
    const example=play(lesson.fen,lesson.move);await report(example);
    const lifted=new Chess(example);lifted.remove('a5');await report(lifted.fen());
    assert(screen.getByText(messages.Chessnut.replace));
    await report(example);
    assert.equal(screen.getByRole('button',{name:messages.MicroLessons.tryYourself}).disabled,false);
    fireEvent.click(screen.getByRole('button',{name:messages.MicroLessons.tryYourself}));
    await report(lesson.challenge);await report(play(lesson.challenge,lesson.answer));
    await waitFor(()=>assert(screen.getByText(messages.MicroLessons.complete)));
});

test('apple worlds work with a real rook and no kings, while illegal diagonals are rejected',async()=>{
    const level=WORLDS.find(world=>world.id==='rook').levels[0],finished=[];
    const initial='8/8/8/8/8/8/8/R7';peripheral.notify(initial);
    mount(MiniBoardGame,{level,onComplete:(...args)=>finished.push(args)});await connect();
    await report('8/8/8/8/8/8/1R6/8');assert.equal(finished.length,0);
    await report(initial);await report('8/8/8/R7/8/8/8/8');
    await waitFor(()=>assert.equal(finished.length,1));assert.equal(finished[0][0],3);
});

test('pawn wars recognize kingless pawn moves and promotion-rank wins',async()=>{
    const finished=[];peripheral.notify('8/P7/8/8/8/8/7p/8');
    mount(PawnWarsGame,{level:{id:'test-pawns',type:'pawnWars',white:['a7'],black:['h2']},onComplete:(...args)=>finished.push(args)});
    await connect();await report('P7/8/8/8/8/8/7p/8');
    await waitFor(()=>assert.equal(finished.length,1));assert.equal(finished[0][0],3);
});

test('pawn wars guide a computer reply and reject playing ahead of it',async()=>{
    peripheral.notify('8/8/7p/8/8/P7/8/8');
    mount(PawnWarsGame,{level:{id:'reply-pawns',type:'pawnWars',white:['a3'],black:['h6']},onComplete:()=>{}});
    await connect();await report('8/8/7p/8/P7/8/8/8');
    await waitFor(()=>assert(JSON.parse(position('pawns-reply-pawns')).h5),{timeout:2000});
    await report('8/8/7p/P7/8/8/8/8');
    assert(JSON.parse(position('pawns-reply-pawns')).a4);
    await report('8/8/8/7p/P7/8/8/8');await report('8/8/8/P6p/8/8/8/8');
    assert(JSON.parse(position('pawns-reply-pawns')).a5);
});

test('a shared session keeps the Bluetooth pairing when an exercise remounts',async()=>{
    const first=WORLDS.find(world=>world.id==='rook').levels[0],second=WORLDS.find(world=>world.id==='bishop').levels[0];
    peripheral.notify('8/8/8/8/8/8/8/R7');
    const view=render(wrap(React.createElement(ChessnutSession,null,React.createElement(MiniBoardGame,{key:'one',level:first,onComplete:()=>{}}))));
    await connect();assert.equal(peripheral.requests.length,1);
    view.rerender(wrap(React.createElement(ChessnutSession,null,React.createElement(MiniBoardGame,{key:'two',level:second,onComplete:()=>{}}))));
    await settle();assert.equal(peripheral.server.connected,true);assert.equal(peripheral.requests.length,1);
    await report('8/8/8/8/8/8/8/2B5');
    assert(screen.getByText(messages.Chessnut.ready));
});

test('mini-world puzzles keep the connection and wait for physical completion between questions',async()=>{
    ladder=[{id:'one',fen:start,solution:'e2e4 e7e5'},{id:'two',fen:start,solution:'e2e4 e7e5'}];
    const finished=[];
    render(wrap(React.createElement(ChessnutSession,null,React.createElement(MiniPuzzleGame,{level:{id:'mate-test',type:'puzzles',startRating:400,count:2,tags:['mateIn1']},onComplete:(...args)=>finished.push(args)}))));
    await connect();
    const e4=play(start,'e2e4'),e5=play(e4,'e7e5');
    await waitFor(()=>assert.equal(position('quick-puzzle'),e4));
    await report(e4);await report(e5);
    assert.equal(finished.length,0);
    await waitFor(()=>assert.equal(new Chess(position('quick-puzzle')).get('e7')?.type,'p','the second question has loaded'),{timeout:6500});
    assert.equal(peripheral.requests.length,1);
    await waitFor(()=>assert.equal(position('quick-puzzle'),e4));
    await report(e4);await waitFor(()=>assert(screen.getByText(messages.Chessnut.ready)));await report(e5);
    await waitFor(()=>assert.equal(finished.length,1),{timeout:6500});assert.equal(finished[0][0],3);
});

async function startLichess() {
    mount(PlayPage);await connect();
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:messages.Play.start})));
    assert(stream);
    await act(async()=>stream({gameId:'test-game',moves:'',status:'started',playerColor:'white'}));
}

test('Lichess physical moves are sent once, failures are recoverable and stream replies win over late acknowledgements',async()=>{
    await startLichess();const e4=play(start,'e2e4'),e5=play(e4,'e7e5');
    await report(e4);assert.equal(moves.length,1);assert.equal(position('play-vs-lichess'),start);
    await report(e4);assert.equal(moves.length,1);
    await act(async()=>moves[0].resolve(false));await settle();
    assert(screen.getByText(messages.Chessnut.restore));
    await report(start);await report(e4);assert.equal(moves.length,2);
    await act(async()=>stream({gameId:'test-game',moves:'e2e4 e7e5',status:'started',playerColor:'white'}));
    await act(async()=>moves[1].resolve(true));
    assert.equal(position('play-vs-lichess'),e5,'late HTTP acknowledgement cannot overwrite a newer streamed AI reply');
    await report(e5);await report(play(e5,'g1f3'));assert.equal(moves.length,3);
    const oldStream=stream;
    fireEvent.click(screen.getByRole('button',{name:messages.Play.newGame}));
    await act(async()=>moves[2].resolve(true));assert.equal(position('play-vs-lichess'),start);
    await act(async()=>oldStream({gameId:'test-game',moves:'e2e4 e7e5',status:'started',playerColor:'white'}));
    assert.equal(position('play-vs-lichess'),start,'a retired stream cannot change the new board');
});

test('Lichess completion waits for the physical final position before saving activity',async()=>{
    await startLichess();const e4=play(start,'e2e4'),e5=play(e4,'e7e5');
    await report(e4);await act(async()=>moves[0].resolve(true));
    await act(async()=>stream({gameId:'test-game',moves:'e2e4 e7e5',status:'finished',winner:'white',playerColor:'white'}));
    await settle();assert.equal(saves.length,0);
    await report(e5);await waitFor(()=>assert.equal(saves.length,1));assert.equal(saves[0].key,'freeplay:test-game');
});
