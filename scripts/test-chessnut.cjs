/* eslint-disable @typescript-eslint/no-require-imports -- Exercise protocol and transport without BLE hardware. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { sourceLoader, packet, fakeBoard } = require('./test-support/chessnut.cjs');
const load = sourceLoader();
const { decodeChessnutPosition, ChessnutPositionReader, chessnutLedCommand, differentSquares, physicalMove } = load('src/lib/chessnut.ts');
const { ChessnutConnection } = load('src/lib/chessnutBluetooth.ts');
const start = new Chess().fen();
function after(fen, uci) { const game = new Chess(fen); game.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] }); return game.fen(); }

test('published piece mapping and h8-first wire order decode the standard setup', () => {
    const fixture = Uint8Array.from([1,34, 0x58,0x23,0x31,0x85, 0x44,0x44,0x44,0x44, ...Array(16).fill(0), 0x77,0x77,0x77,0x77, 0xa6,0xc9,0x9b,0x6a, 0,0]);
    assert.equal(decodeChessnutPosition(fixture), start.split(' ')[0]);
    assert.deepEqual(packet(start), fixture);
    fixture[2] = 0xff;
    assert.equal(decodeChessnutPosition(fixture), null);
    assert.equal(decodeChessnutPosition(new Uint8Array(20)), null);
});

test('fragmented, combined and malformed notifications never become partial board positions', () => {
    const reader = new ChessnutPositionReader(), first = packet(start), second = packet(after(start, 'e2e4'));
    assert.deepEqual(reader.push(Uint8Array.from([0xff, 0x80])), []);
    assert.deepEqual(reader.push(first.slice(0, 20)), []);
    assert.deepEqual(reader.push(Uint8Array.from([...first.slice(20), ...second])), [start.split(' ')[0], after(start, 'e2e4').split(' ')[0]]);
    const compact = first.slice(0,34); compact[1] = 32;
    assert.deepEqual(reader.push(compact), [start.split(' ')[0]]);
});

test('classic Air 01 24 reports decode without waiting for nonexistent trailer bytes', () => {
    const reader = new ChessnutPositionReader(), first = packet(start).slice(0,34);
    first[1] = 0x24;
    assert.deepEqual(reader.push(first.slice(0,20)), []);
    assert.deepEqual(reader.push(first.slice(20)), [start.split(' ')[0]]);
    const second = packet(after(start,'e2e4')).slice(0,34); second[1] = 0x24;
    assert.deepEqual(reader.push(Uint8Array.from([...first,0,0,...second])), [start.split(' ')[0],after(start,'e2e4').split(' ')[0]]);
});

test('LED bit order matches printed coordinates, independently of the screen orientation', () => {
    assert.deepEqual([...chessnutLedCommand(['h8','a1','e2','e4'])], [10,8,1,0,0,0,8,0,8,128]);
    assert.deepEqual(differentSquares(start, after(start,'e2e4')), ['e4','e2']);
});

test('student move inference distinguishes wrong legal moves and ignores piece lifts', () => {
    assert.equal(physicalMove(start, after(start,'e2e4').split(' ')[0], ['e2e4']).uci, 'e2e4');
    assert.equal(physicalMove(start, after(start,'e2e3').split(' ')[0], ['e2e4']).uci, 'e2e3');
    assert.equal(physicalMove(start, start.split(' ')[0].replace('PPPPPPPP','PPPP1PPP'), ['e2e4']).kind, 'adjusting');
});

test('castling waits for both pieces, including a rook moved before the king', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    for (const partial of ['r3k2r/8/8/8/8/8/8/R3KR2', 'r3k2r/8/8/8/8/8/8/R5KR'])
        assert.equal(physicalMove(fen, partial, ['e1g1']).kind, 'adjusting');
    assert.equal(physicalMove(fen, after(fen,'e1g1').split(' ')[0], ['e1g1']).uci, 'e1g1');
});

test('capture, en passant and exact promotion identity are inferred from complete positions', () => {
    for (const [fen, uci] of [
        ['4k3/8/8/8/3p4/4P3/8/4K3 w - - 0 1','e3d4'],
        ['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1','e5d6'],
        ['4k3/P7/8/8/8/8/8/4K3 w - - 0 1','a7a8n'],
    ]) assert.equal(physicalMove(fen, after(fen,uci).split(' ')[0], [uci]).uci, uci);
    assert.equal(physicalMove('4k3/P7/8/8/8/8/8/4K3 w - - 0 1','P3k3/8/8/8/8/8/8/4K3',['a7a8q']).kind,'adjusting');
});

test('BLE connection requests both services, starts streaming, serializes LED writes and cleans up', async () => {
    const board = fakeBoard(), observed = [];
    let disconnected = 0;
    const client = new ChessnutConnection({ position: value => observed.push(value), disconnected: () => disconnected++, error: error => { throw error; } });
    assert.equal(await client.connect(board.bluetooth), 'Chessnut Air');
    assert.equal(board.requests[0].optionalServices.length, 2);
    assert.equal(observed[0], start.split(' ')[0]);
    await Promise.all([client.setLights(['e2','e4']), client.setLights([])]);
    assert.deepEqual(board.writes.at(-2), [10,8,0,0,0,0,8,0,8,0]);
    await client.disconnect();
    board.notify(after(start,'e2e4'));
    assert.equal(observed.length, 1);
    assert.equal(board.server.connected, false);
    assert.equal(disconnected, 0);
});

test('failed discovery is cleaned up and cancelling the chooser cannot later connect a stale device', async () => {
    const board = fakeBoard();
    const callbacks = { position() {}, disconnected() {}, error() {} };
    const client = new ChessnutConnection(callbacks);
    board.server.getPrimaryService = async () => { throw new Error('service missing'); };
    await assert.rejects(client.connect(board.bluetooth), /service missing/);
    assert.equal(board.server.connected, false);
    let resolve;
    const pending = new ChessnutConnection(callbacks);
    const connecting = pending.connect({ requestDevice: () => new Promise(done => { resolve = done; }) });
    pending.dispose(); resolve(board.device);
    await assert.rejects(connecting, { name: 'AbortError' });
    assert.equal(board.server.connected, false);
});
