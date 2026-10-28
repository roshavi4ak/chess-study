/* eslint-disable @typescript-eslint/no-require-imports -- Test the real trainer with a simulated BLE board and persistence. */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost/en/practices/example' });
for (const key of ['window','self','document','navigator','HTMLElement','Node','Event'])
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.isSecureContext = true;
const React = require('react');
const { render, screen, fireEvent, waitFor, act, cleanup } = require('@testing-library/react');
const { NextIntlClientProvider } = require('next-intl');
const { Chess } = require('chess.js');
const { sourceLoader, fakeBoard } = require('./test-support/chessnut.cjs');
const messages = Object.fromEntries(['en','bg'].map(locale => [locale, require(`../messages/${locale}.json`)]));
let saves, peripheral;
const load = sourceLoader({
    'react-chessboard': { Chessboard: ({ options }) => {
        const game = new Chess(options.position);
        return React.createElement('div', { 'data-testid': 'board', 'data-position': options.position },
            ...game.moves({ verbose: true }).map(move => React.createElement('button', {
                key: move.from + move.to + (move.promotion ?? ''), disabled: options.allowDragging === false,
                onClick: () => options.onPieceDrop({ sourceSquare: move.from, targetSquare: move.to }),
            }, move.from + move.to + (move.promotion ?? ''))));
    } },
    '@/app/actions/progress': { saveLineProgress: async data => { saves.push(data); } },
    '@/components/LichessAnalysisLink': () => null,
    '@/components/WhyQuestionCard': () => null,
    '@/i18n/navigation': { Link: ({ children, href }) => React.createElement('a', { href }, children) },
});
const PracticeSession = load('src/components/PracticeSession.tsx').default;
function practice(moves, playerColor = 'WHITE', fen = new Chess().fen()) {
    const game = new Chess(fen), tree = { id: 'root', fen, move: null, notes: null, children: [] };
    let node = tree;
    for (const [index, uci] of moves.entries()) {
        game.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] });
        const child = { id: `node-${index}`, fen: game.fen(), move: uci, notes: null, children: [] };
        node.children = [child]; node = child;
    }
    return { id: 'test', name: 'Test opening', description: null, creatorName: null, playerColor, tree };
}
function mount(moves = ['e2e4','e7e5'], locale = 'en', color = 'WHITE', fen) {
    const selected = practice(moves, color, fen);
    render(React.createElement(NextIntlClientProvider, { locale, messages: messages[locale], timeZone: 'Europe/Sofia' },
        React.createElement(PracticeSession, { practice: selected, initialProgress: [] })));
    return selected;
}
const position = () => screen.getByTestId('board').getAttribute('data-position');
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 340)); });
async function report(fen) { await act(async () => peripheral.notify(fen)); await settle(); }
async function connect(locale = 'en') {
    await act(async () => fireEvent.click(screen.getByRole('button', { name: messages[locale].Chessnut.connect })));
    await settle();
}
function play(fen, uci) { const game = new Chess(fen); game.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] }); return game.fen(); }
beforeEach(() => {
    saves = []; peripheral = fakeBoard();
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: peripheral.bluetooth });
});
afterEach(async () => { await act(async () => cleanup()); });

for (const locale of ['en','bg']) test(`${locale}: opponent LEDs wait for physical confirmation before saving completion`, async () => {
    const selected = mount(undefined, locale);
    const start = selected.tree.fen, e4 = play(start,'e2e4'), e5 = play(e4,'e7e5');
    await connect(locale);
    assert(screen.getByText(messages[locale].Chessnut.ready));
    assert.equal(screen.getByRole('button',{ name:'e2e4' }).disabled, true);
    await report(e4);
    assert.equal(position(), e4, 'digital opponent reply is still pending');
    assert.equal(saves.length, 0);
    await waitFor(() => assert(screen.getByText(messages[locale].Chessnut.opponentMove.replace('{move}','e7 → e5'))));
    assert.deepEqual(peripheral.writes.at(-1), [10,8,0,8,0,8,0,0,0,0]);
    // Lifting the opponent pawn cannot finish a line.
    const lifted = new Chess(e4); lifted.remove('e7');
    await report(lifted.fen());
    assert.equal(saves.length, 0);
    await report(e5);
    await waitFor(() => assert.equal(saves.length, 1));
    assert.equal(position(), e5);
    assert.equal(saves[0].hadWrongMoves, false);
    await report(e5);
    assert.equal(saves.length, 1, 'duplicate notifications never save twice');
});

test('a wrong legal move counts once and must be undone before the correct move is accepted', async () => {
    const selected = mount(), start = selected.tree.fen, wrong = play(start,'d2d4'), e4 = play(start,'e2e4');
    await connect();
    await report(wrong);
    assert(screen.getByText(messages.en.Chessnut.restore));
    await report(wrong);
    await report(e4);
    assert.equal(position(), start, 'cannot jump directly from wrong position to expected next move');
    await report(start);
    await report(e4);
    await report(play(e4,'e7e5'));
    await waitFor(() => assert.equal(saves.length, 1));
    assert.equal(saves[0].mistakes, 1);
});

test('disconnect freezes a pending reply; reconnect requires alignment and can safely resume', async () => {
    const selected = mount(), start = selected.tree.fen, e4 = play(start,'e2e4'), e5 = play(e4,'e7e5');
    await connect(); await report(e4);
    await act(async () => peripheral.server.disconnect());
    await report(e5);
    assert.equal(position(), e4); assert.equal(saves.length, 0);
    await act(async () => fireEvent.click(screen.getByRole('button',{name:messages.en.Chessnut.reconnect})));
    await settle();
    assert.equal(saves.length,0, 'offline move cannot bypass reconnection alignment');
    await report(e4);
    await report(e5);
    await waitFor(() => assert.equal(saves.length,1));
});

test('playing Black first requires the root setup, then confirms White’s first move', async () => {
    const selected = mount(undefined, 'en', 'BLACK');
    await connect();
    assert.equal(position(), selected.tree.fen);
    const e4 = play(selected.tree.fen,'e2e4');
    await report(e4);
    assert.equal(position(),e4); assert.equal(saves.length,0);
    await report(play(e4,'e7e5'));
    await waitFor(() => assert.equal(saves.length,1));
});

test('restart disarms move input until the real board is reset; screen mode can finish a pending reply', async () => {
    const selected = mount(), start = selected.tree.fen, e4 = play(start,'e2e4');
    await connect(); await report(e4);
    fireEvent.click(screen.getByRole('button',{ name:messages.en.Practice.restartPractice }));
    await settle();
    assert.equal(position(),start);
    assert(screen.getByText(messages.en.Chessnut.setup));
    await report(start); await report(e4);
    await act(async () => fireEvent.click(screen.getByRole('button',{name:messages.en.Chessnut.useScreen})));
    await waitFor(() => assert.equal(saves.length,1));
    assert.equal(position(),play(e4,'e7e5'));
    assert.equal(peripheral.server.connected,false);
});

test('ordinary on-screen practice still completes without Bluetooth support', async () => {
    Object.defineProperty(navigator,'bluetooth',{configurable:true,value:undefined});
    mount();
    assert(screen.getByText(messages.en.Chessnut.unsupported));
    await act(async () => fireEvent.click(screen.getByRole('button',{name:'e2e4'})));
    await waitFor(() => assert.equal(saves.length,1));
});

test('failed connection offers retry and screen recovery without recording a result', async () => {
    peripheral.bluetooth.requestDevice = async () => { throw new Error('radio unavailable'); };
    mount();
    await connect();
    assert(screen.getByRole('alert'));
    assert(screen.getByRole('button',{name:messages.en.Chessnut.reconnect}));
    assert.equal(saves.length,0);
    await act(async () => fireEvent.click(screen.getByRole('button',{name:messages.en.Chessnut.useScreen})));
    assert.equal(screen.getByRole('button',{name:'e2e4'}).disabled,false);
});

test('physical castling waits for the king even if the rook is moved first', async () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    peripheral.notify(fen);
    mount(['e1g1'], 'en', 'WHITE', fen);
    await connect();
    await report(play(fen,'h1f1'));
    assert.equal(saves.length,0);
    assert.equal(position(),fen);
    await report(play(fen,'e1g1'));
    await waitFor(() => assert.equal(saves.length,1));
    assert.equal(saves[0].mistakes,0);
});

test('a physical underpromotion must match the repertoire’s actual promoted piece', async () => {
    const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
    peripheral.notify(fen);
    mount(['a7a8n'], 'en', 'WHITE', fen);
    await connect();
    await report(play(fen,'a7a8q'));
    assert.equal(saves.length,0);
    await report(fen);
    await report(play(fen,'a7a8n'));
    await waitFor(() => assert.equal(saves.length,1));
    assert.equal(saves[0].mistakes,1);
});

const completionLights = [10,8,0,0,0,24,24,0,0,0];
const sameCommand = (left, right) => JSON.stringify(left) === JSON.stringify(right);

for (const locale of ['en','bg']) test(`${locale}: a board hint appears after two wrong attempts, once the position is restored`, async () => {
    const selected = mount(undefined, locale), start = selected.tree.fen;
    await connect(locale);
    await report(play(start,'d2d4'));
    await report(start);
    assert(screen.getByText(messages[locale].Chessnut.ready));
    assert.deepEqual(peripheral.writes.at(-1),[10,8,0,0,0,0,0,0,0,0]);
    await report(play(start,'g1f3'));
    assert(screen.getByText(messages[locale].Chessnut.restore));
    await report(start);
    await waitFor(() => assert(screen.getByText(messages[locale].Chessnut.hintMove.replace('{move}','e2 → e4'))));
    assert.deepEqual(peripheral.writes.at(-1),[10,8,0,0,0,0,8,0,8,0]);
    const e4 = play(start,'e2e4');
    await report(e4);
    await waitFor(() => assert(screen.getByText(messages[locale].Chessnut.opponentMove.replace('{move}','e7 → e5'))));
    assert.deepEqual(peripheral.writes.at(-1),[10,8,0,8,0,8,0,0,0,0]);
    await report(play(e4,'e7e5'));
    await waitFor(() => assert.equal(saves.length,1));
    assert.equal(saves[0].mistakes,2);
});

test('the four centre lights flash ten times only after final physical confirmation, without repeat celebrations', async () => {
    const selected = mount(), start = selected.tree.fen, e4 = play(start,'e2e4'), e5 = play(e4,'e7e5');
    await connect(); await report(e4);
    assert.equal(peripheral.writes.filter(command => sameCommand(command,completionLights)).length,0);
    await report(e5);
    await waitFor(() => assert(screen.getByText(messages.en.Chessnut.complete)));
    await act(async () => { await new Promise(resolve => setTimeout(resolve,4600)); });
    assert.equal(peripheral.writes.filter(command => sameCommand(command,completionLights)).length,10);
    assert.deepEqual(peripheral.writes.at(-1),[10,8,0,0,0,0,0,0,0,0]);
    await report(e5);
    assert.equal(peripheral.writes.filter(command => sameCommand(command,completionLights)).length,10);
    assert.equal(saves.length,1);
});

test('starting another line cancels the previous completion light pattern', async () => {
    const selected = mount(), start = selected.tree.fen, e4 = play(start,'e2e4');
    await connect(); await report(e4); await report(play(e4,'e7e5'));
    await waitFor(() => assert(screen.getByText(messages.en.Chessnut.complete)));
    fireEvent.click(screen.getByRole('button',{name:messages.en.Practice.repeatLine}));
    await settle();
    const pulses = peripheral.writes.filter(command => sameCommand(command,completionLights)).length;
    await act(async () => { await new Promise(resolve => setTimeout(resolve,1000)); });
    assert.equal(peripheral.writes.filter(command => sameCommand(command,completionLights)).length,pulses);
    assert(screen.getByText(messages.en.Chessnut.setup));
    assert.equal(saves.length,1);
});

const offLights = [10,8,0,0,0,0,0,0,0,0];
const pause = async ms => act(async () => { await new Promise(resolve => setTimeout(resolve,ms)); });
const pulseSequence = (squares, count) => [...Array.from({length:count},()=>[squares,offLights]).flat(),squares];

test('a wrong move flashes the correction squares three times, then holds them without restarting on duplicate reports', async () => {
    const selected = mount(), start = selected.tree.fen, wrong = play(start,'d2d4');
    const correction = [10,8,0,0,0,0,16,0,16,0];
    await connect();
    const boundary = peripheral.writes.length;
    await report(wrong);
    await pause(1450);
    assert.deepEqual(peripheral.writes.slice(boundary),pulseSequence(correction,3));
    const count = peripheral.writes.length;
    await report(wrong); await pause(300);
    assert.equal(peripheral.writes.length,count);
    await report(start);
    assert.deepEqual(peripheral.writes.at(-1),offLights);
    assert.equal(saves.length,0);
});

test('an earned hint flashes five times, stays lit and yields immediately to opponent guidance', async () => {
    const selected = mount(), start = selected.tree.fen, hint = [10,8,0,0,0,0,8,0,8,0];
    await connect();
    await report(play(start,'d2d4')); await report(start);
    await report(play(start,'g1f3'));
    const boundary = peripheral.writes.length;
    await report(start);
    await pause(2350);
    const hintIndex = peripheral.writes.findIndex((command,index)=>index>=boundary&&sameCommand(command,hint));
    assert(hintIndex>=boundary);
    assert.deepEqual(peripheral.writes.slice(hintIndex),pulseSequence(hint,5));
    const count = peripheral.writes.length;
    await report(start); await pause(300);
    assert.equal(peripheral.writes.length,count);
    await report(play(start,'e2e4'));
    await waitFor(()=>assert(screen.getByText(messages.en.Chessnut.opponentMove.replace('{move}','e7 → e5'))));
    assert.deepEqual(peripheral.writes.at(-1),[10,8,0,8,0,8,0,0,0,0]);
});

test('restoring the position during a wrong-move flash cancels all remaining flashes', async () => {
    const selected = mount(), start = selected.tree.fen;
    await connect(); await report(play(start,'d2d4')); await report(start);
    const count = peripheral.writes.length;
    await pause(1400);
    assert.equal(peripheral.writes.length,count);
    assert.deepEqual(peripheral.writes.at(-1),offLights);
    assert(screen.getByText(messages.en.Chessnut.ready));
});
