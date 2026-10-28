/* eslint-disable @typescript-eslint/no-require-imports -- Shared test loader and a fake BLE peripheral. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Chess } = require('chess.js');

function sourceLoader(boundaries = {}) {
    const cache = new Map();
    function load(file) {
        const base = path.isAbsolute(file) ? file : path.resolve(__dirname, '../..', file);
        const filename = fs.existsSync(base) ? base : ['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate));
        if (cache.has(filename)) return cache.get(filename).exports;
        const mod = new Module(filename, module);
        mod.filename = filename;
        mod.paths = Module._nodeModulePaths(path.dirname(filename));
        cache.set(filename, mod);
        const original = mod.require.bind(mod);
        mod.require = name => Object.hasOwn(boundaries, name) ? boundaries[name]
            : name.startsWith('@/') ? load(path.resolve(__dirname, '../../src', name.slice(2)))
                : name.startsWith('./') ? load(path.resolve(path.dirname(filename), name)) : original(name);
        mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
        }).outputText, filename);
        return mod.exports;
    }
    return load;
}

function packet(fen) {
    const ranks = fen.split(' ')[0].split('/').map(rank => [...rank].flatMap(character => /[1-8]/.test(character) ? Array(Number(character)).fill('') : [character]));
    const pieces = ['', 'q', 'k', 'b', 'p', 'n', 'R', 'P', 'r', 'B', 'N', 'Q', 'K'];
    const bytes = new Uint8Array(36);
    bytes[0] = 1; bytes[1] = 34;
    for (let index = 0; index < 64; index++) {
        const piece = ranks[Math.floor(index / 8)][7 - index % 8];
        const code = pieces.indexOf(piece);
        bytes[2 + Math.floor(index / 2)] |= code << (index % 2 * 4);
    }
    return bytes;
}

function emitter(target = {}) {
    const listeners = new Map();
    return Object.assign(target, {
        addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
        removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
        emit(name) { for (const callback of listeners.get(name) ?? []) callback(); },
    });
}

function fakeBoard() {
    const writes = [], requests = [];
    const positions = emitter({ properties: {}, async startNotifications() { return this; } });
    let currentFen = new Chess().fen();
    const commands = { properties: { write: true }, async writeValueWithResponse(bytes) {
        writes.push([...bytes]);
        if (bytes[0] === 0x21) notify(currentFen);
    } };
    const server = {
        connected: false,
        async connect() { this.connected = true; return this; },
        disconnect() { const wasConnected = this.connected; this.connected = false; if (wasConnected) device.emit('gattserverdisconnected'); },
        async getPrimaryService(uuid) { return { async getCharacteristic() { return uuid.includes('8261') ? positions : commands; } }; },
    };
    const device = emitter({ name: 'Chessnut Air', gatt: server });
    function notify(fen) {
        currentFen = fen;
        const bytes = packet(fen);
        positions.value = new DataView(bytes.buffer);
        positions.emit('characteristicvaluechanged');
    }
    return { writes, requests, device, server, positions, commands, notify,
        bluetooth: { async requestDevice(options) { requests.push(options); return device; } },
    };
}

module.exports = { sourceLoader, packet, fakeBoard };
