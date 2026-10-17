/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
// Plays each built-in-engine animal bot against the one below it and checks that every step is stronger.
// Bots that use Stockfish (Fox and up) run only in the browser, so they are not played here; their
// fallback policy is still checked to move quickly.
// Usage: node scripts/bot-ladder.cjs [gamesPerPair=8]
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Chess } = require('chess.js');

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

const { chooseBotMove, materialBalance } = loadSource('../src/lib/botEngine.ts');
const { BOTS } = loadSource('../src/lib/bots.ts');

// Small seeded generator so runs are repeatable.
function seeded(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

const MAX_PLIES = 160;

// Returns 1 if white wins, 0 if black wins, 0.5 for a draw (material decides unfinished games).
function playGame(white, black, random) {
    const game = new Chess();
    for (let ply = 0; ply < MAX_PLIES && !game.isGameOver(); ply++) {
        const bot = game.turn() === 'w' ? white : black;
        const uci = chooseBotMove(game.fen(), bot.policy, random);
        game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    if (game.isCheckmate()) return game.turn() === 'w' ? 0 : 1;
    if (game.isGameOver()) return 0.5;
    const balance = materialBalance(game.fen());
    return balance > 300 ? 1 : balance < -300 ? 0 : 0.5;
}

const gamesPerPair = Number(process.argv[2] ?? 8);
const random = seeded(2026);
const results = [];
const builtIn = BOTS.filter(bot => !bot.stockfish);
for (let index = 1; index < builtIn.length; index++) {
    const stronger = builtIn[index];
    const weaker = builtIn[index - 1];
    const started = Date.now();
    let score = 0;
    for (let game = 0; game < gamesPerPair; game++) {
        score += game % 2 === 0 ? playGame(stronger, weaker, random) : 1 - playGame(weaker, stronger, random);
    }
    results.push({ pair: `${stronger.id} vs ${weaker.id}`, score, games: gamesPerPair, seconds: ((Date.now() - started) / 1000).toFixed(1) });
    console.log(`${stronger.id.padEnd(8)} vs ${weaker.id.padEnd(8)} ${score}/${gamesPerPair}  (${results.at(-1).seconds}s)`);
}

// Every bot should score clearly more than half against the one below it.
for (const result of results) {
    assert.ok(result.score >= result.games * 0.6, `${result.pair} scored only ${result.score}/${result.games}`);
}

// The fallback move for every bot (including Stockfish ones) must be fast enough for a tablet.
const middlegame = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 9';
for (const bot of BOTS) {
    const started = Date.now();
    for (let i = 0; i < 20; i++) chooseBotMove(middlegame, bot.policy, random);
    const perMove = (Date.now() - started) / 20;
    assert.ok(perMove < 50, `${bot.id} takes ${perMove}ms per fallback move`);
}
console.log('Bot ladder checks passed.');
