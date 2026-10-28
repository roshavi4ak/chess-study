/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
// Notation trainer: question levels, lenient answer checking (English piece letters) and stars.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
const { Chess } = require('chess.js');

function loadSource(relative) {
    const file = path.resolve(__dirname, relative), mod = new Module(file, module);
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, file);
    return mod.exports;
}
const notation = loadSource('../src/lib/notationTrainer.ts');

function seeded(seed) {
    return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

test('every level produces legal questions of its own kind', () => {
    const random = seeded(42);
    for (const level of notation.NOTATION_LEVELS) {
        const kinds = new Set();
        for (let i = 0; i < 40; i++) {
            const question = notation.makeNotationQuestion(level, random);
            const chess = new Chess(question.fen);
            const move = chess.move({ from: question.from, to: question.to, promotion: question.promotion });
            assert.equal(move.san, question.san, 'the stored SAN matches the move in the position');
            assert(notation.fitsLevel(move, level), `${question.san} fits level ${level}`);
            if (level === 1) assert.match(question.san, /^([NBRQK])?[a-h][1-8]$/);
            if (level === 2) assert.match(question.san, /x/);
            if (level === 3) kinds.add(question.san.startsWith('O-O') ? 'castle' : question.san.includes('=') ? 'promote' : question.san.includes('#') ? 'mate' : 'check');
            if (level === 4) assert.match(question.san, /^[NBRQK]([a-h]|[1-8]|[a-h][1-8])x?[a-h][1-8]/);
        }
        if (level === 3) assert(kinds.size >= 3, `level 3 mixes kinds: ${[...kinds]}`);
    }
});

test('answers are read leniently: 0-0, missing "=", spaces, Cyrillic look-alikes', () => {
    assert.equal(notation.checkWrittenAnswer('Nf3', 'Nf3'), 'exact');
    assert.equal(notation.checkWrittenAnswer('Kf3', 'Nf3'), 'wrong', 'K is the king, never the knight');
    assert.equal(notation.checkWrittenAnswer('Кe2', 'Ke2'), 'exact', 'a Cyrillic К typed by mistake is read as K');
    assert.equal(notation.checkWrittenAnswer('Вb5', 'Bb5'), 'exact', 'a Cyrillic В is read as B');
    assert.equal(notation.checkWrittenAnswer('Nс3', 'Nc3'), 'exact', 'a Cyrillic с is read as the c-file');
    assert.equal(notation.checkWrittenAnswer('Дh5', 'Qh5'), 'wrong', 'Bulgarian piece letters are not accepted');
    assert.equal(notation.checkWrittenAnswer('0-0', 'O-O'), 'exact');
    assert.equal(notation.checkWrittenAnswer('o-o-o', 'O-O-O'), 'exact');
    assert.equal(notation.checkWrittenAnswer('ОО', 'O-O'), 'exact', 'Cyrillic О and no hyphen');
    assert.equal(notation.checkWrittenAnswer('e8Q', 'e8=Q'), 'exact');
    assert.equal(notation.checkWrittenAnswer('exd8Q+', 'exd8=Q+'), 'exact');
    assert.equal(notation.checkWrittenAnswer(' N b d2 ', 'Nbd2'), 'exact');
    assert.equal(notation.checkWrittenAnswer('NXe5', 'Nxe5'), 'exact');
    assert.equal(notation.checkWrittenAnswer('Nf3!', 'Nf3'), 'exact');
});

test('a wrong or missing check sign still counts, with a reminder; other mistakes do not', () => {
    assert.equal(notation.checkWrittenAnswer('Qh5', 'Qh5+'), 'markOff');
    assert.equal(notation.checkWrittenAnswer('Qf7+', 'Qf7#'), 'markOff');
    assert.equal(notation.checkWrittenAnswer('Qf7+', 'Qf7'), 'markOff');
    assert.equal(notation.checkWrittenAnswer('O-O', 'O-O+'), 'markOff');
    assert.equal(notation.checkWrittenAnswer('Ne5', 'Nxe5'), 'wrong', 'the capture sign matters');
    assert.equal(notation.checkWrittenAnswer('Nd2', 'Nbd2'), 'wrong', 'the extra file matters');
    assert.equal(notation.checkWrittenAnswer('', 'e4'), 'wrong');
    assert.equal(notation.checkWrittenAnswer('+', 'e4'), 'wrong');
});

test('playing the written move on the board, and stars for a round of ten', () => {
    const question = { fen: '', san: 'e8=N', from: 'e7', to: 'e8', promotion: 'n' };
    assert(notation.playedRight(question, { from: 'e7', to: 'e8', promotion: 'n' }));
    assert(!notation.playedRight(question, { from: 'e7', to: 'e8', promotion: 'q' }));
    assert(notation.playedRight({ fen: '', san: 'Nf3', from: 'g1', to: 'f3' }, { from: 'g1', to: 'f3' }));
    assert(!notation.playedRight({ fen: '', san: 'Nf3', from: 'g1', to: 'f3' }, { from: 'e2', to: 'e4' }));
    assert.deepEqual([10, 9, 8, 7, 6, 5, 0].map(notation.notationStars), [3, 2, 2, 1, 1, 0, 0]);
    assert.equal(notation.notationKey('write', 3), 'notation:write-3');
});
