/* eslint-disable @typescript-eslint/no-require-imports -- Run real component state with mocked board and persistence boundaries. */
const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');
const assert=require('node:assert/strict');const {test,beforeEach,afterEach}=require('node:test');const ts=require('typescript');
const {JSDOM}=require('jsdom');const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/bg/fun/endgames'});
for(const key of ['window','self','document','navigator','HTMLElement','Node','Event'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const {render,screen,fireEvent,waitFor,cleanup,act,within}=require('@testing-library/react');
const {NextIntlClientProvider}=require('next-intl');const {Chess}=require('chess.js');
let saves, requests, botReply, session, randomStart;
const realFetch=globalThis.fetch;
const cache=new Map();
function Board({options}) {
    const game=new Chess(options.position);
    return React.createElement('div',{'data-testid':options.id,'data-position':options.position,'data-orientation':options.boardOrientation,'data-arrows':JSON.stringify(options.arrows??[]),'data-styles':JSON.stringify(options.squareStyles??{})},
        ...'abcdefgh'.split('').flatMap(file=>'12345678'.split('').map(rank=>React.createElement('button',{key:file+rank,onClick:()=>options.onSquareClick?.({square:file+rank})},`square ${file}${rank}`))),
        ...game.moves({verbose:true}).map(move=>{const uci=move.from+move.to+(move.promotion??'');return React.createElement('button',{key:uci,disabled:options.allowDragging===false,onClick:()=>options.onPieceDrop?.({sourceSquare:move.from,targetSquare:move.to})},uci);}));
}
const boundaries={
    'react-chessboard':{Chessboard:Board},
    'next/image':({src,alt,...props})=>React.createElement('img',{src,alt,...props}),
    'next-auth/react':{useSession:()=>({data:session,status:session?'authenticated':'unauthenticated'})},
    '@/i18n/navigation':{Link:({href,children,...props})=>React.createElement('a',{href,...props},children)},
    '@/app/actions/play':{recordPlaySession:async data=>{saves.push(data);},getPersonalBests:async()=>({byKey:{}})},
    '@/lib/botEngine':{chooseBotMove:fen=>botReply(fen)},
    '@/lib/trainingEngine':{trainingMove:(fen,signal)=>new Promise(resolve=>{requests.push({fen,signal,resolve});}),trainingAnalysis:(fen,signal)=>new Promise(resolve=>{requests.push({fen,signal,resolve,analysis:true});})},
    '@/lib/endgameClient':{endgameMove:(fen,signal)=>new Promise(resolve=>{requests.push({fen,signal,resolve});}),endgameAdvice:(fen,signal)=>new Promise(resolve=>{requests.push({fen,signal,resolve,advice:true});})},
    '@/lib/endgameTraining':{...loadEndgames(),randomEndgameFen:(challenge,previous)=>randomStart(challenge,previous)},
};
function loadEndgames() {
    const file=path.resolve(__dirname,'../src/lib/endgameTraining.ts');
    const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
    mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
    return mod.exports;
}
function loadSource(file) {
    const base=path.isAbsolute(file)?file:path.resolve(__dirname,file);
    const filename=fs.existsSync(base)?base:['.ts','.tsx'].map(ext=>base+ext).find(candidate=>fs.existsSync(candidate));
    if(cache.has(filename))return cache.get(filename).exports;
    const mod=new Module(filename,module);mod.filename=filename;cache.set(filename,mod);mod.paths=Module._nodeModulePaths(path.dirname(filename));const original=mod.require.bind(mod);
    mod.require=name=>Object.hasOwn(boundaries,name)?boundaries[name]:name.startsWith('@/')?loadSource(path.resolve(__dirname,'../src',name.slice(2))):name.startsWith('./')&&!name.endsWith('.json')?loadSource(path.resolve(path.dirname(filename),name)):original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
    return mod.exports;
}
const EndgameTrainer=loadSource('../src/components/EndgameTrainer.tsx').default;
const DefenseTrainer=loadSource('../src/components/DefenseTrainer.tsx').default;
const BotGame=loadSource('../src/components/BotGame.tsx').default;
const {defenseRound}=loadSource('../src/lib/defenseTraining.ts');
const messages=Object.fromEntries(['en','bg'].map(locale=>[locale,require(`../messages/${locale}.json`)]));
const localized=(component,locale)=>React.createElement(NextIntlClientProvider,{locale,messages:messages[locale],timeZone:'Europe/Sofia'},component);
const move=async(id,uci)=>act(async()=>fireEvent.click(within(screen.getByTestId(id)).getByRole('button',{name:uci})));
function practice(locale='en') {fireEvent.click(screen.getByRole('button',{name:messages[locale].EndgameLessons.try}));}
beforeEach(()=>{saves=[];requests=[];session={user:{id:'student'}};randomStart=challenge=>challenge.fen;globalThis.fetch=realFetch;botReply=fen=>{const game=new Chess(fen);return game.moves({verbose:true}).map(m=>m.from+m.to+(m.promotion??''))[0];};});
afterEach(()=>{cleanup();globalThis.fetch=realFetch;});
for(const locale of ['en','bg']) test(`${locale}: endgame plays to actual mate and records an unrated activity once`,async()=>{
    render(localized(React.createElement(EndgameTrainer),locale));
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames.rookMate.title}));
    practice(locale);
    await move('endgame-board','f5g6');assert.equal(requests.length,1);
    await act(async()=>requests[0].resolve('h8g8'));
    await move('endgame-board','a1a8');
    await waitFor(()=>assert.equal(saves.length,1));
    assert(new Chess(screen.getByTestId('endgame-board').getAttribute('data-position')).isCheckmate());
    assert.equal(saves[0].kind,'MINIGAME');assert.equal(saves[0].key,'endgame:rookMate');assert.equal(saves[0].won,true);assert.equal(saves[0].score,3);
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames.newPosition}));assert.equal(saves.length,1);
});
test('restart cancels a hint and a pending computer move, and late replies cannot change the new board',async()=>{
    render(localized(React.createElement(EndgameTrainer),'en'));
    practice();
    await move('endgame-board','g4h5');const old=requests[0];
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.restart}));assert(old.signal.aborted);
    const start=screen.getByTestId('endgame-board').getAttribute('data-position');
    await act(async()=>old.resolve('h8g8'));assert.equal(screen.getByTestId('endgame-board').getAttribute('data-position'),start);
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.hint})));
    const hint=requests[1];
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.restart}));assert(hint.signal.aborted);
    await act(async()=>hint.resolve('g4h5'));assert.equal(screen.queryByText(messages.en.LearningHelp.assisted),null);
    assert.equal(saves.length,0);
});
test('computer failure leaves a retry path and takeback restores the student turn',async()=>{
    render(localized(React.createElement(EndgameTrainer),'en'));
    practice();
    await move('endgame-board','g4h5');await act(async()=>requests[0].resolve(null));assert(screen.getByRole('alert'));
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.retryComputer}));assert.equal(requests.length,2);
    await act(async()=>requests[1].resolve('h8g8'));
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.takeback}));
    assert.equal(new Chess(screen.getByTestId('endgame-board').getAttribute('data-position')).turn(),'w');assert.equal(saves.length,0);
});
for(const locale of ['en','bg']) test(`${locale}: defense round identifies threats, explains a mistake, and saves learning rather than ratings`,async()=>{
    render(localized(React.createElement(DefenseTrainer),locale));
    for(const [index,position] of defenseRound(0).entries()) {
        fireEvent.click(screen.getByRole('button',{name:messages[locale].Defense.showMove}));
        fireEvent.click(within(screen.getByTestId('defense-board')).getByRole('button',{name:`square ${position.target}`}));
        if(index===0) {await move('defense-board',position.tempting);assert(screen.getByRole('heading',{name:messages[locale].Defense.consequence}));}
        await move('defense-board',position.safe);
        fireEvent.click(screen.getByRole('button',{name:messages[locale].Defense.next}));
    }
    await waitFor(()=>assert.equal(saves.length,1));assert.equal(saves[0].details.independent,4);assert.equal(saves[0].details.total,5);assert.equal(saves[0].kind,'MINIGAME');assert.equal(saves[0].score,1);
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Defense.newRound}));assert.equal(saves.length,1);
});
const bot={id:'sloth',avatar:'Sloth.png',policy:{randomChance:1,lookahead:0,captureWeight:0,style:'none'},takebacks:true};
test('teaching warns before an immediate mate, allows retry or the chosen move, and records the final result only once',async()=>{
    botReply=fen=>new Chess(fen).get('e7')?'e7e5':'d8h4';const results=[];
    render(localized(React.createElement(BotGame,{bot,childColor:'w',onFinish:(...args)=>results.push(args)}),'en'));
    await move('bot-game','f2f3');
    await waitFor(()=>assert(new Chess(screen.getByTestId('bot-game').getAttribute('data-position')).get('e5')));
    await move('bot-game','g2g4');assert(screen.getByText(messages.en.BotTeaching.mateWarning));
    assert(new Chess(screen.getByTestId('bot-game').getAttribute('data-position')).get('g2'));
    fireEvent.click(screen.getByRole('button',{name:messages.en.BotTeaching.tryAnother}));assert.equal(screen.queryByText(messages.en.BotTeaching.mateWarning),null);
    await move('bot-game','g2g4');fireEvent.click(screen.getByRole('button',{name:messages.en.BotTeaching.playAnyway}));
    await waitFor(()=>assert.equal(results.length,1));assert.deepEqual(results[0],['loss',4,true]);
});
test('threat quiz accepts a correct piece and turning help off restores ordinary play',async()=>{
    botReply=()=> 'd7d5';
    render(localized(React.createElement(BotGame,{bot,childColor:'w',onFinish:()=>{}}),'bg'));
    await move('bot-game','e2e4');await waitFor(()=>assert(screen.queryByText(messages.bg.BotTeaching.identifyThreat)));
    fireEvent.click(within(screen.getByTestId('bot-game')).getByRole('button',{name:'square a2'}));assert(screen.getByText(messages.bg.BotTeaching.wrongPiece));
    fireEvent.click(within(screen.getByTestId('bot-game')).getByRole('button',{name:'square e4'}));assert.equal(screen.queryByText(messages.bg.BotTeaching.identifyThreat),null);
    fireEvent.click(screen.getByRole('checkbox',{name:messages.bg.BotTeaching.enabled}));assert.equal(screen.queryByText(messages.bg.BotTeaching.intro),null);
});
test('resigning cancels a pending engine reply and cannot change the final board or record twice',async()=>{
    const results=[];const engineBot={...bot,policy:{...bot.policy,randomChance:0},stockfish:{skill:2,depth:3}};
    render(localized(React.createElement(BotGame,{bot:engineBot,childColor:'w',onFinish:(...args)=>results.push(args)}),'en'));
    await move('bot-game','e2e4');assert.equal(requests.length,1);
    const finalFen=screen.getByTestId('bot-game').getAttribute('data-position');
    fireEvent.click(screen.getByRole('button',{name:messages.en.Bots.resign}));assert(requests[0].signal.aborted);
    await act(async()=>requests[0].resolve('e7e5'));
    assert.equal(screen.getByTestId('bot-game').getAttribute('data-position'),finalFen);assert.equal(results.length,1);
});

const puzzleGroups=require('./fixtures/defense-puzzles.json');
for(const locale of ['en','bg']) for(const level of [2,10]) test(`${locale}: defense level ${level} uses real puzzles, plays the full line, saves level progress and requests a fresh round`,async()=>{
    const puzzles=puzzleGroups.find(g=>g.level===level).puzzles;const urls=[];
    globalThis.fetch=async url=>{urls.push(url);return{ok:true,json:async()=>({puzzles})};};
    render(localized(React.createElement(DefenseTrainer),locale));
    fireEvent.click(screen.getByRole('button',{name:messages[locale].DefenseLevels.level.replace('{level}',level)}));
    await waitFor(()=>assert(screen.queryByTestId('defense-puzzle-board')));
    for(const puzzle of puzzles) {
        assert(screen.getByText(new RegExp(puzzle.name)));
        assert.equal(screen.getByTestId('defense-puzzle-board').getAttribute('data-orientation'),puzzle.side==='w'?'white':'black');
        fireEvent.click(screen.getByRole('button',{name:messages[locale].Defense.showMove}));
        for(let index=0;index<puzzle.moves.length;index+=2) await move('defense-puzzle-board',puzzle.moves[index]);
        assert.equal(requests.length,0,'validated stored moves need no engine check');
        fireEvent.click(screen.getByRole('button',{name:messages[locale].Defense.next}));
    }
    await waitFor(()=>assert.equal(saves.length,1));
    assert.equal(saves[0].key,`defense:level:${level}`);assert.equal(saves[0].details.level,level);assert.equal(saves[0].score,3);
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Defense.newRound}));
    await waitFor(()=>assert.equal(urls.length,2));assert(urls[1].includes(encodeURIComponent(puzzles[0].id)));
});
test('switching defense levels cancels a load and a late response cannot replace the new level',async()=>{
    const loads=[];globalThis.fetch=(url,options)=>new Promise(resolve=>loads.push({url,signal:options.signal,resolve}));
    render(localized(React.createElement(DefenseTrainer),'en'));
    fireEvent.click(screen.getByRole('button',{name:'Level 2'}));assert.equal(loads.length,1);
    fireEvent.click(screen.getByRole('button',{name:'Level 10'}));assert(loads[0].signal.aborted);
    await act(async()=>loads[1].resolve({ok:true,json:async()=>({puzzles:puzzleGroups.at(-1).puzzles})}));
    const fen=screen.getByTestId('defense-puzzle-board').getAttribute('data-position');
    await act(async()=>loads[0].resolve({ok:true,json:async()=>({puzzles:puzzleGroups[0].puzzles})}));
    assert.equal(screen.getByTestId('defense-puzzle-board').getAttribute('data-position'),fen);
});
test('an engine-checked alternative can fail with a legal continuation or pass without changing puzzle ratings',async()=>{
    const puzzles=puzzleGroups[0].puzzles;globalThis.fetch=async()=>({ok:true,json:async()=>({puzzles})});
    render(localized(React.createElement(DefenseTrainer),'en'));
    fireEvent.click(screen.getByRole('button',{name:'Level 2'}));await waitFor(()=>assert(screen.queryByTestId('defense-puzzle-board')));
    fireEvent.click(screen.getByRole('button',{name:messages.en.Defense.showMove}));
    const fen=screen.getByTestId('defense-puzzle-board').getAttribute('data-position');
    const candidate=new Chess(fen).moves({verbose:true}).map(m=>m.from+m.to+(m.promotion??'')).find(m=>m!==puzzles[0].moves[0]);
    await move('defense-puzzle-board',candidate);assert.equal(requests.length,1);
    await act(async()=>requests[0].resolve({score:{type:'cp',value:0},pv:[]}));assert.equal(requests.length,2);
    const after=new Chess(requests[1].fen);const reply=after.moves({verbose:true})[0];
    await act(async()=>requests[1].resolve({score:{type:'cp',value:200},pv:reply?[reply.from+reply.to+(reply.promotion??'')]:[]}));
    assert(screen.getByRole('heading',{name:messages.en.Defense.consequence}));
    assert.equal(screen.getByTestId('defense-puzzle-board').getAttribute('data-position'),fen);
    await move('defense-puzzle-board',candidate);
    await act(async()=>requests[2].resolve({score:{type:'cp',value:0},pv:[]}));
    await act(async()=>requests[3].resolve({score:{type:'cp',value:-100},pv:[]}));
    assert(screen.getByText(messages.en.DefenseLevels.alternative));assert.equal(saves.length,0);
});
test('an engine check keeps the board playable, can be stopped, and a solved puzzle links to Lichess analysis',async()=>{
    const puzzles=puzzleGroups[0].puzzles;globalThis.fetch=async()=>({ok:true,json:async()=>({puzzles})});
    render(localized(React.createElement(DefenseTrainer),'en'));
    fireEvent.click(screen.getByRole('button',{name:'Level 2'}));await waitFor(()=>assert(screen.queryByTestId('defense-puzzle-board')));
    fireEvent.click(screen.getByRole('button',{name:messages.en.Defense.showMove}));
    const fen=screen.getByTestId('defense-puzzle-board').getAttribute('data-position');
    const [first,second]=new Chess(fen).moves({verbose:true}).map(m=>m.from+m.to+(m.promotion??'')).filter(m=>m!==puzzles[0].moves[0]);
    await move('defense-puzzle-board',first);
    assert(screen.getByText(messages.en.DefenseLevels.checking));
    assert.equal(within(screen.getByTestId('defense-puzzle-board')).getByRole('button',{name:second}).disabled,false);
    await move('defense-puzzle-board',second);assert(requests[0].signal.aborted);assert.equal(requests.length,2);
    await act(async()=>requests[0].resolve({score:{type:'cp',value:0},pv:[]}));assert.equal(requests.length,2);
    fireEvent.click(screen.getByRole('button',{name:messages.en.DefenseLevels.stopChecking}));
    assert(requests[1].signal.aborted);assert.equal(screen.queryByText(messages.en.DefenseLevels.checking),null);
    await act(async()=>requests[1].resolve({score:{type:'cp',value:0},pv:[]}));
    assert.equal(requests.length,2);assert.equal(screen.queryByRole('heading',{name:messages.en.Defense.consequence}),null);
    await move('defense-puzzle-board',first);assert.equal(requests.length,3);
    for(let index=0;index<puzzles[0].moves.length;index+=2) await move('defense-puzzle-board',puzzles[0].moves[index]);
    assert(requests[2].signal.aborted);assert.equal(screen.queryByText(messages.en.DefenseLevels.checking),null);
    const link=screen.getByRole('link',{name:messages.en.Common.openLichessAnalysis});
    assert(link.getAttribute('href').startsWith('https://lichess.org/analysis/standard/'+screen.getByTestId('defense-puzzle-board').getAttribute('data-position').replaceAll(' ','_')));
});
test('restarting an endgame replaces the complete arrangement and cancels a pending advisor move',async()=>{
    const pool=require('../src/lib/endgameStarts.json').positions.queenMate;let index=0;
    randomStart=()=>pool[index++].fen;
    render(localized(React.createElement(EndgameTrainer),'en'));
    practice();
    await move('endgame-board','g4h5');const pending=requests[0];
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.restart}));
    assert(pending.signal.aborted);assert.equal(screen.getByTestId('endgame-board').getAttribute('data-position'),pool[0].fen);
    await act(async()=>pending.resolve('h8g8'));assert.equal(screen.getByTestId('endgame-board').getAttribute('data-position'),pool[0].fen);
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.restart}));
    assert.equal(screen.getByTestId('endgame-board').getAttribute('data-position'),pool[1].fen);
});

const lessons=loadSource('../src/lib/endgameLessons.ts').ENDGAME_LESSONS;
for(const locale of ['en','bg']) test(`${locale}: bishop and knight tutorial shows protection, turns and continuous moves without a hidden king jump`,()=>{
    render(localized(React.createElement(EndgameTrainer),locale));
    const t=messages[locale].EndgameLessons;
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames.bishopKnightMate.title}));
    const board=()=>screen.getByTestId('endgame-tutorial');
    const fen=()=>board().getAttribute('data-position');
    const initial=fen();
    assert(screen.getByRole('status').textContent.includes(t.whiteToMove));
    assert(JSON.parse(board().getAttribute('data-arrows')).some(a=>a.startSquare==='b3'&&a.endSquare==='f7'&&a.color==='#15803d'));
    assert(screen.getByRole('complementary',{name:t.knightSafety}).textContent.includes('b3'));
    const pretendBlack=initial.split(' ');pretendBlack[1]='b';
    assert(!new Chess(pretendBlack.join(' ')).moves({verbose:true}).some(m=>m.to==='f7'));
    fireEvent.click(screen.getByRole('button',{name:t.nextStep}));assert.equal(fen(),initial);assert(screen.getByText(t.samePosition));
    for(let index=2;index<=lessons.bishopKnightMate.findIndex(step=>step.id==='routeA');index++)fireEvent.click(screen.getByRole('button',{name:t.nextStep}));assert.equal(fen(),initial);
    for(const [index,expected]of ['e5','e5','d7','d7'].entries()){
        fireEvent.click(screen.getByRole('button',{name:t.showMove}));
        const game=new Chess(fen());assert.equal(game.get(expected).type,'n');
        assert(screen.getByRole('status').textContent.includes(index%2===0?t.blackToMove:t.whiteToMove));
        assert(screen.getByText(t.bishopKnightMate.routeA[`move${index+1}`]));
        const arrows=JSON.parse(board().getAttribute('data-arrows')).filter(a=>a.color==='#15803d');
        assert(arrows.every(a=>a.endSquare===expected&&game.attackers(expected,'w').includes(a.startSquare)));
    }
    const routeEnd=fen();fireEvent.click(screen.getByRole('button',{name:t.nextStep}));assert.equal(fen(),routeEnd);
    for(let i=0;i<4;i++)fireEvent.click(screen.getByRole('button',{name:t.showMove}));
    for(let index=lessons.bishopKnightMate.findIndex(step=>step.id==='routeB')+1;index<lessons.bishopKnightMate.length;index++)fireEvent.click(screen.getByRole('button',{name:t.nextStep}));assert(screen.getByText(t.newExample));
    assert.equal(new Chess(fen()).get('a6').type,'b');
    fireEvent.click(screen.getByRole('button',{name:t.showMove}));assert(new Chess(fen()).isCheckmate());assert(screen.getByRole('status').textContent.includes(t.checkmate));
    assert.equal(requests.length,0);assert.equal(saves.length,0);
});
for(const locale of ['en','bg']) test(`${locale}: mating nets show real exits and all defensive branches replay independently without saving student results`,()=>{
    render(localized(React.createElement(EndgameTrainer),locale));
    const t=messages[locale].EndgameLessons;
    const board=()=>screen.getByTestId('endgame-tutorial');
    const next=()=>fireEvent.click(screen.getByRole('button',{name:t.showMove}));
    for(const id of ['queenMate','rookMate','bishopPairMate','bishopKnightMate']){
        fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames[id].title}));
        assert(screen.getByRole('complementary',{name:t.netTitle}));
        for(const [index,step]of lessons[id].entries()){
            if(id==='bishopKnightMate'&&step.id==='net'){
                const styles=()=>JSON.parse(board().getAttribute('data-styles'));
                assert.equal(styles().f8.backgroundColor,'rgba(56,189,248,.5)');
                assert(screen.getByText(t.oneExit));
                fireEvent.click(screen.getByRole('checkbox',{name:t.showNet}));
                assert.notEqual(styles().f8?.backgroundColor,'rgba(56,189,248,.5)');
                fireEvent.click(screen.getByRole('checkbox',{name:t.showNet}));
                assert.equal(styles().f8.backgroundColor,'rgba(56,189,248,.5)');
            }
            for(const branch of step.branches||[]){
                fireEvent.click(screen.getByRole('button',{name:t[id][step.id][branch.id].title}));
                assert.equal(board().getAttribute('data-position'),step.fen);
                assert(screen.getByText(t[id][step.id][branch.id].explain));
                const game=new Chess(step.fen);
                for(const [ply,uci]of branch.moves.entries()){
                    next();game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
                    assert.equal(board().getAttribute('data-position'),game.fen());
                    assert(screen.getByText(t[id][step.id][branch.id]['move'+(ply+1)]));
                    assert(screen.getByRole('complementary',{name:t.netTitle}).textContent.includes(game.board().flat().find(p=>p?.color==='b'&&p.type==='k').square));
                }
                fireEvent.click(screen.getByRole('button',{name:messages[locale].Training.previous}));
                assert.notEqual(board().getAttribute('data-position'),game.fen());
                fireEvent.click(screen.getByRole('button',{name:t[id][step.id].main}));
                assert.equal(board().getAttribute('data-position'),step.fen);
                assert(screen.getByText(t[id][step.id].explain));
            }
            for(const move of step.moves){void move;next();}
            if(index+1<lessons[id].length)fireEvent.click(screen.getByRole('button',{name:t.nextStep}));
        }
    }
    assert.equal(requests.length,0);assert.equal(saves.length,0);
});
for(const locale of ['en','bg']) test(`${locale}: every endgame opens its own complete strategy tutorial before practice`,()=>{
    render(localized(React.createElement(EndgameTrainer),locale));
    assert(screen.getByTestId('endgame-tutorial'));assert.equal(screen.queryByTestId('endgame-board'),null);
    for(const [id,steps] of Object.entries(lessons)) {
        fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames[id].title}));
        assert.equal(screen.getByTestId('endgame-tutorial').getAttribute('data-position'),steps[0].fen);
        for(const [index,step] of steps.entries()) {
            assert(screen.getByRole('heading',{name:messages[locale].EndgameLessons[id][step.id].title}));
            for(let ply=0;ply<step.moves.length;ply++) fireEvent.click(screen.getByRole('button',{name:messages[locale].EndgameLessons.showMove}));
            const expected=new Chess(step.fen);for(const m of step.moves)expected.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});
            assert.equal(screen.getByTestId('endgame-tutorial').getAttribute('data-position'),expected.fen());
            if(index+1<steps.length)fireEvent.click(screen.getByRole('button',{name:messages[locale].EndgameLessons.nextStep}));
        }
        assert.equal(saves.length,0);assert.equal(requests.length,0,'tutorial examples do not require network advice');
        fireEvent.click(screen.getByRole('button',{name:messages[locale].EndgameLessons.practice}));
        assert(screen.getByTestId('endgame-board'));assert.equal(screen.queryByTestId('endgame-tutorial'),null);
    }
});
test('reviewing a tutorial preserves the board, cancels a hint, and records a helped result without changing an already completed result',async()=>{
    render(localized(React.createElement(EndgameTrainer),'en'));
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.rookMate.title}));practice();
    await move('endgame-board','f5g6');await act(async()=>requests[0].resolve('h8g8'));
    const fen=screen.getByTestId('endgame-board').getAttribute('data-position');
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.hint}));const pending=requests[1];
    fireEvent.click(screen.getByRole('button',{name:messages.en.EndgameLessons.learn}));assert(pending.signal.aborted);
    await act(async()=>pending.resolve({move:'a1a8',category:'win',dtm:1}));practice();
    assert.equal(screen.getByTestId('endgame-board').getAttribute('data-position'),fen);
    await move('endgame-board','a1a8');await waitFor(()=>assert.equal(saves.length,1));
    assert.equal(saves[0].score,1);assert.equal(saves[0].details.assisted,true);
    fireEvent.click(screen.getByRole('button',{name:messages.en.EndgameLessons.learn}));practice();assert.equal(saves.length,1);
});
for(const locale of ['en','bg']) test(`${locale}: hints describe the current endgame, piece, exact move and actual board effect`,async()=>{
    render(localized(React.createElement(EndgameTrainer),locale));
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames.rookMate.title}));practice(locale);
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames.hint}));
    await act(async()=>requests[0].resolve({move:'f5g6',category:'win',dtm:3}));
    const hint=screen.getAllByRole('status').find(el=>el.tagName==='ASIDE');assert(hint);
    assert(hint.textContent.includes('h8'));assert(hint.textContent.includes('f5'));
    assert(!hint.textContent.includes(messages[locale].LearningHelp.quiet));
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames.hint}));
    assert(within(hint).getByText(messages[locale].EndgameHints.reason_kingApproach));
    fireEvent.click(screen.getByRole('button',{name:messages[locale].Endgames.hint}));
    assert(hint.textContent.includes('Kg6'));assert(hint.textContent.includes('g6'));
    assert(JSON.parse(screen.getByTestId('endgame-board').getAttribute('data-arrows')).some(a=>a.startSquare==='f5'&&a.endSquare==='g6'));
    assert.equal(requests.length,1,'three hint stages share one verified move');
});
test('an independent win remains independent when the student reviews the tutorial afterward',async()=>{
    render(localized(React.createElement(EndgameTrainer),'en'));
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.rookMate.title}));practice();
    await move('endgame-board','f5g6');await act(async()=>requests[0].resolve('h8g8'));await move('endgame-board','a1a8');
    await waitFor(()=>assert.equal(saves.length,1));assert.equal(saves[0].score,3);
    fireEvent.click(screen.getByRole('button',{name:messages.en.EndgameLessons.learn}));practice();
    assert(screen.getByText(messages.en.Endgames.wonAlone));assert.equal(saves.length,1);
});
test('a failed checkmate goal warns when the tablebase position is drawn',async()=>{
    render(localized(React.createElement(EndgameTrainer),'en'));practice();
    fireEvent.click(screen.getByRole('button',{name:messages.en.Endgames.hint}));
    await act(async()=>requests[0].resolve({move:'g4h5',category:'draw',dtm:null}));
    assert(screen.getByText(messages.en.EndgameHints.cannotWin));assert.equal(saves.length,0);
});
test('review pauses a pending computer move and resumes from the same board without accepting its stale reply',async()=>{
    render(localized(React.createElement(EndgameTrainer),'en'));practice();
    await move('endgame-board','g4h5');const pending=requests[0],fen=screen.getByTestId('endgame-board').getAttribute('data-position');
    fireEvent.click(screen.getByRole('button',{name:messages.en.EndgameLessons.learn}));assert(pending.signal.aborted);
    await act(async()=>pending.resolve('h8g8'));assert.equal(screen.getByTestId('endgame-board').getAttribute('data-position'),fen);
    practice();assert.equal(requests.length,2);
    await act(async()=>requests[1].resolve('h8g8'));
    assert.notEqual(screen.getByTestId('endgame-board').getAttribute('data-position'),fen);assert.equal(saves.length,0);
});
