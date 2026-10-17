/* eslint-disable @typescript-eslint/no-require-imports -- Run component regressions directly with Node. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Module = require('node:module');
const { test, beforeEach, afterEach } = require('node:test');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

// Resolve next-intl's extensionless Next imports as the bundler normally would.
// The Link boundary is mocked; the shared localized helper itself is real.
Module.registerHooks({
    resolve(specifier, context, nextResolve) {
        const target = specifier === 'next/link' ? pathToFileURL(path.join(__dirname, 'test-support/next-link.cjs')).href
            : specifier === 'next/navigation' ? 'next/navigation.js' : specifier;
        return nextResolve(target, context);
    },
});

// Exercise real React state, storage events, and next-intl navigation without a
// Next build, a running server, or a database. The board UI, Link boundary and
// server data are replaced; chess moves and submission use the real solver.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/bg/puzzles/current' });
for (const key of ['window', 'self', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'StorageEvent', 'sessionStorage']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup, act, within } = require('@testing-library/react');
const { NextIntlClientProvider } = require('next-intl');
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime');
const { PathnameContext, SearchParamsContext } = require('next/dist/shared/lib/hooks-client-context.shared-runtime');
const { Chess } = require('chess.js');

function loadSource(relativePath, overrides = {}) {
    const filename = path.resolve(__dirname, relativePath);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const loaded = new Module(filename, module);
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : originalRequire(name);
    loaded._compile(output, filename);
    return loaded.exports;
}

const navigation = loadSource('../src/i18n/navigation.ts');
const linkProps = [];
const trackedNavigation = {
    ...navigation,
    Link(props) {
        linkProps.push(props);
        return React.createElement(navigation.Link, props);
    },
};
const dailyMission = loadSource('../src/lib/dailyMission.ts', { './reviewSchedule': loadSource('../src/lib/reviewSchedule.ts') });
const common = {
    '@/i18n/navigation': trackedNavigation,
    '@/lib/utils': loadSource('../src/lib/utils.ts'),
    '@/lib/puzzleThemes': loadSource('../src/lib/puzzleThemes.ts', { './dailyMission': dailyMission }),
};
function TestChessboard({ options }) {
    return React.createElement('div', { 'data-testid': 'board', 'data-position': options.position },
        ['e7e5', 'd7d5'].map(move => React.createElement('button', {
            key: move,
            onClick: () => options.onPieceDrop({ sourceSquare: move.slice(0, 2), targetSquare: move.slice(2) }),
        }, move)));
}
const PuzzleSolver = loadSource('../src/components/PuzzleSolver.tsx', {
    ...common,
    'react-chessboard': { Chessboard: TestChessboard },
    '@/hooks/useLegalMoves': loadSource('../src/hooks/useLegalMoves.ts'),
}).default;
const PuzzleSession = loadSource('../src/components/PuzzleSession.tsx', { ...common, './PuzzleSolver': PuzzleSolver }).default;
let session;
const auth = { useSession: () => ({ data: session, status: session ? 'authenticated' : 'unauthenticated' }) };
const PuzzlesPage = loadSource('../src/app/[locale]/puzzles/page.tsx', { ...common, 'next-auth/react': auth }).default;
const PuzzlePlayPage = loadSource('../src/app/[locale]/puzzles/play/page.tsx', { ...common, 'next-auth/react': auth }).default;
const messages = Object.fromEntries(['en', 'bg'].map(locale => [locale, require(`../messages/${locale}.json`)]));
const originalFetch = globalThis.fetch;
let requests;
let pushes;
let router;

beforeEach(() => {
    sessionStorage.clear();
    linkProps.length = 0;
    requests = [];
    pushes = [];
    session = { user: { id: 'student', role: 'COACH', ratingPuzzle: 1500 } };
    router = { push: href => pushes.push(href), prefetch: () => assert.fail('Unexpected router prefetch') };
    globalThis.fetch = async (input, init) => {
        requests.push({ url: new URL(input, window.location.origin), init });
        return { ok: true, status: 200, json: async () => init?.method === 'POST'
            ? { oldRating: 1500, newRating: 1505, change: 5 }
            : { puzzleName: 'next-puzzle' } };
    };
});
afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
});

function localized(element, locale, query = '') {
    return React.createElement(AppRouterContext.Provider, { value: router },
        React.createElement(PathnameContext.Provider, { value: `/${locale}/puzzles/current` },
            React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) },
                React.createElement(NextIntlClientProvider, { locale, messages: messages[locale], timeZone: 'UTC' }, element))));
}
const puzzleProps = { id: 'current-id', currentPuzzleName: 'current', fen: new Chess().fen(), solution: 'e2e4 e7e5', hints: ['', 'Play e5'] };
const tag = 'fork & pin + mate/# Български';
const readHistory = () => JSON.parse(sessionStorage.getItem('puzzleSession') || '[]');
async function readyToSolve() {
    await waitFor(() => assert.equal(new Chess(screen.getByTestId('board').getAttribute('data-position')).turn(), 'b'));
}
async function play(move) {
    await act(async () => fireEvent.click(within(screen.getByTestId('board')).getByRole('button', { name: move })));
}

for (const locale of ['en', 'bg']) {
    for (const selectedTag of [undefined, tag]) {
        test(`${locale}: 1000 history links disable prefetch and keep the locale${selectedTag ? ' and encoded tag' : ''}`, () => {
            const history = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${i}`, name: `puzzle-${i}`, result: ['success', 'mistake', 'hint'][i % 3] }));
            sessionStorage.setItem('puzzleSession', JSON.stringify(history));
            render(localized(React.createElement(PuzzleSession, { ...puzzleProps, tag: selectedTag }), locale));
            const links = screen.getAllByRole('link');
            assert.equal(links.length, history.length);
            assert.equal(linkProps.length, history.length);
            assert(linkProps.every(props => props.prefetch === false));
            for (const [i, link] of links.entries()) {
                const url = new URL(link.href);
                assert.equal(link.dataset.prefetch, 'false');
                assert.equal(url.pathname, `/${locale}/puzzles/puzzle-${i}`);
                assert.deepEqual([...url.searchParams], selectedTag ? [['tag', selectedTag]] : []);
            }
            fireEvent.mouseEnter(links[0]);
            fireEvent.focus(links.at(-1));
            fireEvent.touchStart(links.at(-1));
            assert.equal(requests.length, 0, 'Rendering and hovering history must not request puzzles or submit results');
            assert.deepEqual(readHistory(), history);
        });
    }

    test(`${locale}: the 100-row coach puzzle table disables prefetch and keeps the locale`, async () => {
        const attempts = Array.from({ length: 100 }, (_, i) => ({
            id: `attempt-${i}`, userId: `student-${i}`, user: { name: 'Student', image: null }, puzzle: { name: `puzzle-${i}`, rating: 1500 },
            success: i % 2 === 0, createdAt: new Date('2026-10-16T09:00:00Z'),
        }));
        const CoachDashboard = loadSource('../src/app/[locale]/coach/dashboard/page.tsx', {
            ...common,
            '@/auth': { auth: async () => session },
            '@/lib/db': { prisma: {
                puzzleAttempt: { findMany: async () => attempts },
                practiceAttempt: { findMany: async () => [] },
                user: { findMany: async () => [] },
            } },
            'next-intl/server': { getTranslations: async () => key => key },
            '@/components/CoachStudentHelp': () => null,
        }).default;
        render(localized(await CoachDashboard(), locale));
        // Each row links the puzzle and the student's profile; none of the 200 links may prefetch.
        const links = screen.getAllByRole('link');
        assert.equal(links.length, 200);
        assert.equal(linkProps.length, 200);
        assert(linkProps.every(props => props.prefetch === false));
        assert(links.every(link => link.dataset.prefetch === 'false'));
        const puzzleLinks = links.filter(link => link.getAttribute('href').includes('/puzzles/'));
        const profileLinks = links.filter(link => link.getAttribute('href').includes('/coach/students/'));
        puzzleLinks.forEach((link, i) => assert.equal(link.getAttribute('href'), `/${locale}/puzzles/puzzle-${i}`));
        profileLinks.forEach((link, i) => assert.equal(link.getAttribute('href'), `/${locale}/coach/students/student-${i}`));
        assert.equal(puzzleLinks.length, 100);
        assert.equal(profileLinks.length, 100);
        assert.equal(requests.length, 0);
    });

    test(`${locale}: category lists disable prefetch and encode tags without disabling individual actions`, async () => {
        const tags = Array.from({ length: 100 }, (_, i) => ({ tag: `${tag} ${i}`, count: i + 1 }));
        globalThis.fetch = async input => {
            assert.equal(input, '/api/puzzles/tags');
            return { ok: true, json: async () => tags };
        };
        render(localized(React.createElement(PuzzlesPage), locale));
        await waitFor(() => assert.equal(screen.getAllByRole('link').length, tags.length + 2));
        const categoryProps = linkProps.filter(props => typeof props.href === 'object');
        assert.equal(categoryProps.length, tags.length);
        assert(categoryProps.every(props => props.prefetch === false));
        const links = screen.getAllByRole('link');
        links.slice(1, -1).forEach((link, i) => {
            const url = new URL(link.href);
            assert.equal(link.dataset.prefetch, 'false');
            assert.equal(url.pathname, `/${locale}/puzzles/play`);
            assert.deepEqual([...url.searchParams], [['tag', tags[i].tag]]);
        });
        assert(linkProps.filter(props => typeof props.href === 'string').every(props => props.prefetch === undefined), 'Keep normal prefetching for individual actions');
    });

    test(`${locale}: solving records once, next navigation keeps tags, and revisiting resets the solver`, async () => {
        sessionStorage.setItem('puzzleSession', JSON.stringify([{ id: 'previous-id', name: 'previous', result: 'mistake' }]));
        const view = render(localized(React.createElement(PuzzleSession, { ...puzzleProps, tag }), locale));
        assert.equal(requests.length, 0);
        await readyToSolve();
        await play('e7e5');
        await waitFor(() => assert.equal(requests.length, 1));
        assert.equal(requests[0].url.pathname, '/api/puzzles/submit');
        assert.equal(requests[0].init.method, 'POST');
        assert.deepEqual(JSON.parse(requests[0].init.body), { puzzleId: puzzleProps.id, success: true });
        assert.deepEqual(readHistory().at(-1), { id: puzzleProps.id, name: puzzleProps.currentPuzzleName, result: 'success' });
        await act(async () => fireEvent.click(screen.getByRole('button', { name: messages[locale].PuzzleSolver.nextPuzzle })));
        assert.equal(requests.length, 2);
        assert.equal(requests[1].url.pathname, '/api/puzzles/next');
        assert.deepEqual([...requests[1].url.searchParams], [['exclude', 'current'], ['tag', tag]]);
        const nextUrl = new URL(pushes[0], window.location.origin);
        assert.equal(nextUrl.pathname, `/${locale}/puzzles/next-puzzle`);
        assert.deepEqual([...nextUrl.searchParams], [['tag', tag]]);

        const previousLink = screen.getByRole('link', { name: '1' });
        assert.equal(new URL(previousLink.href).pathname, `/${locale}/puzzles/previous`);
        fireEvent.click(previousLink);
        const previousUrl = new URL(pushes.at(-1), window.location.origin);
        assert.equal(previousUrl.pathname, `/${locale}/puzzles/previous`);
        assert.deepEqual([...previousUrl.searchParams], [['tag', tag]]);
        // Simulate the route selected by the history link delivering new props.
        view.rerender(localized(React.createElement(PuzzleSession, { ...puzzleProps, id: 'previous-id', currentPuzzleName: 'previous', tag }), locale));
        assert.equal(screen.queryByRole('button', { name: messages[locale].PuzzleSolver.nextPuzzle }), null);
        assert.equal(new Chess(screen.getByTestId('board').getAttribute('data-position')).turn(), 'w');
        await readyToSolve();
        await play('e7e5');
        assert.deepEqual(readHistory(), [
            { id: 'previous-id', name: 'previous', result: 'success' },
            { id: puzzleProps.id, name: puzzleProps.currentPuzzleName, result: 'success' },
        ]);
        assert(screen.getByRole('link', { name: '1' }).classList.contains('bg-green-500'));
        assert.equal(requests.filter(request => request.init?.method === 'POST').length, 2);
    });

    test(`${locale}: entering tagged play and sign-in uses the existing localized router`, async () => {
        const view = render(localized(React.createElement(PuzzlePlayPage), locale, new URLSearchParams({ tag })));
        await waitFor(() => assert.equal(pushes.length, 1));
        assert.equal(requests.length, 1);
        assert.equal(requests[0].url.searchParams.get('tag'), tag);
        assert.equal(requests[0].url.searchParams.get('rating'), '1500');
        assert.equal(requests[0].url.searchParams.get('userId'), 'student');
        const url = new URL(pushes[0], window.location.origin);
        assert.equal(url.pathname, `/${locale}/puzzles/next-puzzle`);
        assert.deepEqual([...url.searchParams], [['tag', tag]]);
        view.unmount();
        session = null;
        render(localized(React.createElement(PuzzlePlayPage), locale));
        await waitFor(() => assert.equal(pushes.at(-1), `/${locale}/sign-in`));
        assert.equal(requests.length, 1, 'Signing in must not select another puzzle');
    });
}

for (const result of ['hint', 'mistake']) {
    test(`${result} outcomes still record once and become successful on a later visit`, async () => {
        const view = render(localized(React.createElement(PuzzleSession, puzzleProps), 'en'));
        await readyToSolve();
        if (result === 'hint') {
            fireEvent.click(screen.getByRole('button', { name: messages.en.PuzzleSolver.showHint }));
        } else {
            await play('d7d5');
            await waitFor(() => assert.equal(screen.queryByText(messages.en.PuzzleSolver.incorrectMove) === null, true), { timeout: 2000 });
        }
        await play('e7e5');
        assert.deepEqual(readHistory(), [{ id: puzzleProps.id, name: puzzleProps.currentPuzzleName, result }]);
        assert.equal(requests.length, 1);
        assert.deepEqual(JSON.parse(requests[0].init.body), { puzzleId: puzzleProps.id, success: false });
        assert(screen.getByRole('link', { name: '1' }).classList.contains(result === 'hint' ? 'bg-yellow-500' : 'bg-red-500'));
        view.unmount();
        render(localized(React.createElement(PuzzleSession, puzzleProps), 'en'));
        await readyToSolve();
        await play('e7e5');
        assert.equal(readHistory().length, 1, 'Revisiting does not duplicate history');
        assert.equal(readHistory()[0].result, 'success');
        assert.equal(requests.length, 2);
    });
}

test('puzzle themes: every Lichess theme and hand-made spelling shows in Bulgarian', () => {
    const { themeLabel, orderThemes } = common['@/lib/puzzleThemes'];
    const categories = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../messages/bg.json'), 'utf8')).PuzzleCategories;
    const t = Object.assign(key => categories[key], { has: key => Object.hasOwn(categories, key) });
    assert.equal(themeLabel('mateIn1', t), categories.mateIn1);
    assert.equal(themeLabel('Fork', t), categories.fork);
    assert.equal(themeLabel('middle game', t), categories.middlegame);
    assert.equal(themeLabel('exposed king', t), categories.exposedKing);
    assert.equal(themeLabel('somethingNew', t), 'somethingNew', 'unknown tags stay readable');
    for (const tag of ['killBoxMate', 'vukovicMate', 'queensideAttack', 'oneMove', 'superGM']) assert.ok(t.has(tag), tag);
    assert.ok(Object.values(categories).every(label => !/[a-z]/.test(label.replace(/f2\/f7/, ''))), 'no Latin letters in Bulgarian theme names');
    assert.deepEqual(orderThemes(['middlegame', 'mate', 'fork', 'short', 'mateIn1', 'fork'], 'mateIn1'), ['mateIn1', 'fork', 'middlegame', 'mate', 'short']);
});
