/* eslint-disable @typescript-eslint/no-require-imports -- Exercise real localized settings state with mocked server actions. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test, beforeEach, afterEach } = require('node:test');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/bg/puzzles' });
for (const key of ['window', 'self', 'document', 'navigator', 'HTMLElement', 'Node', 'Event']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup } = require('@testing-library/react');
const { NextIntlClientProvider } = require('next-intl');
function loadSource(relative, overrides = {}) {
    const file = path.resolve(__dirname, relative), mod = new Module(file, module);
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    const original = mod.require.bind(mod);
    mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
    return mod.exports;
}
const policy = loadSource('../src/lib/puzzleDifficulty.ts');
let view, reads, saves, error, onSaved;
const Settings = loadSource('../src/components/PuzzleDifficultySettings.tsx', {
    '@/lib/puzzleDifficulty': policy,
    '@/app/actions/puzzleDifficulty': {
        getPuzzleDifficulty: async studentId => { reads.push(studentId); return error ? { error } : { view }; },
        savePuzzleDifficulty: async (input, studentId) => {
            saves.push({ input, studentId });
            return error ? { error } : { view: { ...policy.puzzleRatingRange(view.studentRating, { ...view, ...input }), canEditLimits: view.canEditLimits } };
        },
    },
}).default;
beforeEach(() => { view = { ...policy.puzzleRatingRange(1363, null), canEditLimits: false }; reads = []; saves = []; error = ''; onSaved = 0; });
afterEach(cleanup);
const messages = Object.fromEntries(['en', 'bg'].map(locale => [locale, require(`../messages/${locale}.json`)]));
function show(locale, props = {}) {
    render(React.createElement(NextIntlClientProvider, { locale, messages: messages[locale], timeZone: 'Europe/Sofia' },
        React.createElement(Settings, { defaultOpen: true, onSaved: () => onSaved++, ...props })));
    return messages[locale].PuzzleDifficulty;
}
for (const locale of ['en', 'bg']) {
    test(`${locale}: students can select a harder target and save only their preference`, async () => {
        const t = show(locale);
        await screen.findByLabelText(t.preferredOffset);
        assert.equal(screen.queryByLabelText(t.minOffset), null);
        fireEvent.click(screen.getByRole('button', { name: t.preset300 }));
        assert.equal(screen.getByLabelText(t.preferredOffset).value, '300');
        assert(screen.getAllByText(/1663/).length >= 1);
        fireEvent.click(screen.getByRole('button', { name: t.save }));
        await screen.findByText(t.saved);
        assert.deepEqual(saves, [{ input: { preferredOffset: 300 }, studentId: undefined }]);
        assert.equal(onSaved, 1);
    });
    test(`${locale}: a coach can change relative limits and lock the student's choices`, async () => {
        view.canEditLimits = true;
        const t = show(locale, { studentId: 'student' });
        await screen.findByLabelText(t.minOffset);
        fireEvent.change(screen.getByLabelText(t.minOffset), { target: { value: '100' } });
        fireEvent.change(screen.getByLabelText(t.maxOffset), { target: { value: '600' } });
        fireEvent.change(screen.getByLabelText(t.preferredOffset), { target: { value: '300' } });
        fireEvent.click(screen.getByLabelText(t.allowChoice));
        fireEvent.click(screen.getByRole('button', { name: t.save }));
        await screen.findByText(t.saved);
        assert.equal(reads[0], 'student'); assert.equal(saves[0].studentId, 'student');
        for (const [key, expected] of Object.entries({ minOffset: 100, maxOffset: 600, preferredOffset: 300, allowStudentChoice: false })) assert.equal(saves[0].input[key], expected);
    });
    test(`${locale}: coach-locked students see their limits and cannot edit them`, async () => {
        view.allowStudentChoice = false;
        const t = show(locale);
        await screen.findByText(t.locked);
        assert.equal(screen.queryByRole('spinbutton'), null);
        assert.equal(screen.queryByRole('button', { name: t.save }), null);
        assert.equal(saves.length, 0);
    });
    test(`${locale}: a coach change received while saving is explained without claiming success`, async () => {
        const t = show(locale);
        await screen.findByLabelText(t.preferredOffset);
        error = 'locked';
        fireEvent.click(screen.getByRole('button', { name: t.save }));
        await screen.findByRole('alert');
        assert(screen.getByText(t.locked)); assert.equal(screen.queryByText(t.saved), null); assert.equal(onSaved, 0);
    });
}
test('closed settings do not load student data or make server requests', async () => {
    const t = show('en', { defaultOpen: false });
    assert.equal(reads.length, 0);
    const details = screen.getByText(t.title).closest('details');
    details.open = true; fireEvent(details, new Event('toggle'));
    await waitFor(() => assert.equal(reads.length, 1));
});
test('failed loading is recoverable and never renders another student’s old data', async () => {
    error = 'saveFailed'; const t = show('en');
    await screen.findByRole('alert'); assert.equal(screen.queryByRole('spinbutton'), null);
    error = ''; fireEvent.click(screen.getByRole('button', { name: t.retry }));
    await screen.findByLabelText(t.preferredOffset); assert.equal(reads.length, 2);
});
