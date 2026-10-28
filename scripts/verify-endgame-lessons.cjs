/* eslint-disable @typescript-eslint/no-require-imports -- Offline authoring tool; never writes student data. */
// Refresh the proof after editing a lesson: node scripts/verify-endgame-lessons.cjs
// All intermediate boards and every legal alternative are checked, not just endpoints.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { Chess } = require('chess.js');
function loadSource(filename) {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => name.startsWith('./') ? loadSource(path.resolve(path.dirname(filename), name + '.ts')) : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
}
const root = path.resolve(__dirname, '..');
const { ENDGAME_LESSONS } = loadSource(path.join(root, 'src/lib/endgameLessons.ts'));
const { learningMove } = loadSource(path.join(root, 'src/lib/puzzleLearning.ts'));
const source = 'https://tablebase.lichess.ovh/standard';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const cache = new Map();
async function probe(fen) {
    if (cache.has(fen)) return cache.get(fen);
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const response = await fetch(source + '?fen=' + encodeURIComponent(fen), { signal: AbortSignal.timeout(15000) });
            assert(response.ok, 'Tablebase HTTP ' + response.status);
            const data = await response.json();
            assert(['win', 'draw', 'loss'].includes(data.category), 'Unknown tablebase outcome');
            cache.set(fen, data);
            await pause(350);
            return data;
        } catch (error) {
            if (attempt === 4) throw error;
            await pause(10000);
        }
    }
}
const whiteResult = (category, turn) => category === 'draw' ? 'draw' : (category === 'win') === (turn === 'w') ? 'win' : 'loss';
(async () => {
    const examples = [];
    for (const [challenge, steps] of Object.entries(ENDGAME_LESSONS)) for (const parent of steps) for (const step of [parent, ...(parent.branches || []).map(branch => ({ ...parent, id: parent.id + '.' + branch.id, moves: branch.moves }))]) {
        const game = new Chess(step.fen), positions = [];
        for (let ply = 0; ply <= step.moves.length; ply++) {
            const table = await probe(game.fen());
            const expected = challenge === 'holdDraw' || step.id === 'rush' || (step.id === 'stalemate' && ply > 0) ? 'draw' : 'win';
            assert.equal(whiteResult(table.category, game.turn()), expected, `${challenge}/${step.id} ply ${ply}: preserve the lesson's outcome against best defense`);
            const legal = game.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')).sort();
            const moves = table.moves.map(m => ({ uci: m.uci, category: m.category, dtm: m.dtm }));
            assert.deepEqual(moves.map(m => m.uci).sort(), legal, 'All legal alternatives must have a result');
            positions.push({ fen: game.fen(), category: table.category, whiteResult: expected, dtm: table.dtm, moves });
            if (ply < step.moves.length) learningMove(game, step.moves[ply]);
        }
        examples.push({ challenge, step: step.id, moves: step.moves, positions });
        console.log(`Verified ${challenge}/${step.id}: ${positions.length} boards and all legal alternatives`);
    }
    const output = path.join(root, 'docs/endgame-tutorial-verification-2026-10-19.json');
    fs.writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), source, scope: 'Every displayed board and every legal alternative, including intermediate defender turns', examples }, null, 2) + '\n');
    console.log(`Verified ${examples.length} examples, ${examples.reduce((sum, e) => sum + e.positions.length, 0)} displayed boards (${cache.size} unique positions)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
