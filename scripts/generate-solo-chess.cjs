/* eslint-disable @typescript-eslint/no-require-imports -- Run directly with Node. */
// Builds src/lib/soloChessPuzzles.json: 120 different solo chess puzzles in three bands.
// Every puzzle is built backwards from its last piece, so it is solvable; the solver checks it again.
// The random generator is seeded, so running this again produces the same file.
//   node scripts/generate-solo-chess.cjs
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadSource(relativePath, loaded = new Map()) {
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
        ? loadSource(path.relative(__dirname, path.resolve(path.dirname(filename), `${name}.ts`)), loaded)
        : originalRequire(name);
    mod._compile(output, filename);
    return mod.exports;
}

const solo = loadSource('../src/lib/soloChess.ts');

function mulberry32(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// [band, pieces, how many, candidates to choose from]. Harder bands keep the candidates with the fewest solutions.
const PLAN = [
    ['easy', 3, 12, 12],
    ['easy', 4, 28, 40],
    ['medium', 5, 20, 60],
    ['medium', 6, 20, 80],
    ['hard', 7, 20, 120],
    ['hard', 8, 20, 160],
];

const random = mulberry32(20261020);
const seen = new Set();
const puzzles = [];
for (const [band, count, wanted, candidates] of PLAN) {
    const pool = [];
    for (let attempt = 0; pool.length < candidates && attempt < candidates * 200; attempt++) {
        const pieces = solo.buildSoloPosition(count, random);
        if (!pieces) continue;
        const formatted = solo.formatPieces(pieces);
        const key = formatted.join(' ');
        if (seen.has(key) || !solo.solveSolo(pieces)) continue;
        // Avoid near-duplicates where the whole first move is forced in a dull way: require at least two first moves.
        if (count >= 4 && solo.soloMoves(pieces).length < 2) continue;
        seen.add(key);
        pool.push({ pieces: formatted, solutions: solo.countSoloSolutions(pieces) });
    }
    if (pool.length < wanted) throw new Error(`Only ${pool.length} ${count}-piece puzzles found`);
    const chosen = band === 'easy' ? pool.slice(0, wanted) : [...pool].sort((a, b) => a.solutions - b.solutions).slice(0, wanted);
    // Inside a group: more ways to win first, so each band gets gradually harder.
    chosen.sort((a, b) => b.solutions - a.solutions);
    for (const entry of chosen) puzzles.push({ band, ...entry });
}

const output = puzzles.map((puzzle, index) => ({
    id: `solo-${String(index + 1).padStart(3, '0')}`,
    band: puzzle.band,
    pieces: puzzle.pieces,
    solutions: puzzle.solutions,
}));
const file = path.resolve(__dirname, '../src/lib/soloChessPuzzles.json');
fs.writeFileSync(file, `${JSON.stringify(output, null, 1)}\n`);
const summary = Object.fromEntries(solo.SOLO_BANDS.map(band => [band, output.filter(p => p.band === band).length]));
console.log(`Wrote ${output.length} puzzles to ${path.relative(process.cwd(), file)}:`, summary);
