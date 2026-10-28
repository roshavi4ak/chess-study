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
    '@/components/PuzzleDifficultySettings': () => null,
    '@/i18n/navigation': trackedNavigation,
    '@/lib/utils': loadSource('../src/lib/utils.ts'),
    '@/lib/puzzleThemes': loadSource('../src/lib/puzzleThemes.ts', { './dailyMission': dailyMission }),
};
function TestChessboard({ options }) {
    return React.createElement('div', { 'data-testid': 'board', 'data-position': options.position,
        'data-arrows': JSON.stringify(options.arrows), 'data-orientation': options.boardOrientation },
        ['e7e5', 'd7d5', 'g1f3', 'e2e4', 'b8c6', 'e8g8', 'a7a8'].map(move => React.createElement('button', {
            key: move,
            onClick: () => options.onPieceDrop({ sourceSquare: move.slice(0, 2), targetSquare: move.slice(2) }),
        }, move)));
}
const puzzleLearning = loadSource('../src/lib/puzzleLearning.ts');
const analysisLink = loadSource('../src/components/LichessAnalysisLink.tsx', {
    '@/lib/lichessAnalysis': loadSource('../src/lib/lichessAnalysis.ts'),
}).default;
const learningComponents = {
    '@/components/ProgressiveHint': loadSource('../src/components/ProgressiveHint.tsx', { '@/lib/puzzleLearning': puzzleLearning }).default,
    '@/components/MoveConsequence': loadSource('../src/components/MoveConsequence.tsx', {
        '@/lib/puzzleLearning': puzzleLearning, './LichessAnalysisLink': analysisLink, 'react-chessboard': { Chessboard: TestChessboard },
    }).default,
};
const PuzzleSolver = loadSource('../src/components/PuzzleSolver.tsx', {
    ...common,
    ...learningComponents,
    '@/components/LichessAnalysisLink': loadSource('../src/components/LichessAnalysisLink.tsx', {
        '@/lib/lichessAnalysis': loadSource('../src/lib/lichessAnalysis.ts'),
    }).default,
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
            ? { oldRating: 1500, newRating: 1505, change: 5, challengePoints: 10 }
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

    test(`${locale}: paginated coach activity links disable prefetch and keep the locale`, async () => {
        const dashboard = loadSource('../src/lib/coachDashboard.ts');
        const students = Array.from({ length: 100 }, (_, i) => ({
            id: `student-${i}`, name: 'Student', summary: { flags: [], backlog: 0, activeDaysThisWeek: 0 }, homework: [],
        }));
        const rows = students.slice(0, dashboard.DASHBOARD_PAGE_SIZE).map((student, i) => ({
            id: `attempt-${i}`, userId: student.id, studentName: student.name, kind: 'puzzle',
            activityId: `puzzle-${i}`, activityName: `Puzzle ${i}`, rating: 1500,
            status: i % 2 === 0 ? 'solved' : 'failed', createdAt: new Date('2026-10-16T09:00:00Z'),
        }));
        const CoachDashboard = loadSource('../src/app/[locale]/coach/dashboard/page.tsx', {
            ...common,
            '@/auth': { auth: async () => session },
            '@/lib/db': { prisma: { user: { findMany: async () => [] } } },
            '@/app/actions/assignments': { getCoachOverview: async () => ({ students }) },
            '@/lib/coachDashboard': dashboard,
            '@/lib/coachDashboardData': {
                loadDashboardTeams: async () => [],
                loadDashboardActivity: async filters => {
                    assert.equal(filters.view, 'activity');
                    return { rows, total: 100, pagination: dashboard.dashboardPagination(100, filters.page) };
                },
            },
            'next-intl/server': { getTranslations: async () => key => key, getLocale: async () => locale },
            '@/components/CoachDashboardFilters': () => null,
            '@/components/CoachDashboardStudents': () => null,
        }).default;
        // Resolve nested async server components while leaving client components to React.
        async function resolveServer(element) {
            if (Array.isArray(element)) return Promise.all(element.map(resolveServer));
            if (!React.isValidElement(element)) return element;
            if (element.type?.constructor?.name === 'AsyncFunction') return resolveServer(await element.type(element.props));
            const children = await resolveServer(element.props.children);
            return Array.isArray(children) ? React.cloneElement(element, {}, ...children) : React.cloneElement(element, {}, children);
        }
        render(localized(await resolveServer(await CoachDashboard({ searchParams: Promise.resolve({ view: 'activity' }) })), locale));
        // Both responsive layouts contain only the current page. Header/tab links keep normal prefetching.
        const links = screen.getAllByRole('link').filter(link => /\/(puzzles|coach\/students)\//.test(link.getAttribute('href')));
        assert.equal(links.length, dashboard.DASHBOARD_PAGE_SIZE * 4);
        const activityProps = linkProps.filter(props => /\/(puzzles|coach\/students)\//.test(props.href));
        assert.equal(activityProps.length, links.length);
        assert(activityProps.every(props => props.prefetch === false));
        assert(links.every(link => link.dataset.prefetch === 'false'));
        const puzzleLinks = links.filter(link => link.getAttribute('href').includes('/puzzles/'));
        const profileLinks = links.filter(link => link.getAttribute('href').includes('/coach/students/'));
        puzzleLinks.forEach((link, i) => assert.equal(link.getAttribute('href'), `/${locale}/puzzles/puzzle-${i % rows.length}`));
        profileLinks.forEach((link, i) => assert.equal(link.getAttribute('href'), `/${locale}/coach/students/student-${i % rows.length}`));
        assert.equal(puzzleLinks.length, rows.length * 2);
        assert.equal(profileLinks.length, rows.length * 2);
        fireEvent.mouseEnter(puzzleLinks[0]);
        fireEvent.focus(profileLinks.at(-1));
        assert.equal(requests.length, 0);
    });

    test(`${locale}: category lists disable prefetch and encode tags without disabling individual actions`, async () => {
        const tags = Array.from({ length: 100 }, (_, i) => ({ tag: `${tag} ${i}`, count: i + 1 }));
        globalThis.fetch = async input => {
            assert.equal(input, '/api/puzzles/tags');
            return { ok: true, json: async () => tags };
        };
        render(localized(React.createElement(PuzzlesPage), locale));
        await waitFor(() => assert.equal(screen.getAllByRole('link').length, tags.length + 3));
        const categoryProps = linkProps.filter(props => typeof props.href === 'object');
        assert.equal(categoryProps.length, tags.length);
        assert(categoryProps.every(props => props.prefetch === false));
        const links = screen.getAllByRole('link');
        links.filter(link => new URL(link.href).pathname.endsWith('/puzzles/play') && new URL(link.href).searchParams.has('tag')).forEach((link, i) => {
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
        await waitFor(() => assert(screen.getByText(messages[locale].PuzzleSolver.challengePoints.replace('{points}', '10'))));
        assert(screen.getByText(messages[locale].PuzzleSolver.ratingChange.replace('{change}', '+5')));
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
        assert.equal(requests[0].url.searchParams.get('rating'), null, 'the server reads the current rating');
        assert.equal(requests[0].url.searchParams.get('userId'), null, 'the server uses the authenticated user');
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
        assert.deepEqual(JSON.parse(requests[0].init.body), { puzzleId: puzzleProps.id, success: false, ...(result === 'hint' ? { hintUsed: true } : {}) });
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

const boardArrows = () => JSON.parse(screen.getByTestId('board').getAttribute('data-arrows'));
const expectedArrow = (from, to) => [{ startSquare: from, endSquare: to, color: 'rgba(34, 197, 94, 0.85)' }];
async function wrongMove() {
    await play('d7d5');
    await waitFor(() => assert.equal(screen.queryByText(messages.en.PuzzleSolver.incorrectMove) === null, true), { timeout: 2000 });
}

for (const locale of ['en', 'bg']) {
    test(`${locale}: hints work without written notes, draw the next move, and record an unsolved unrated attempt`, async () => {
        globalThis.fetch = async (input, init) => {
            requests.push({ input, init });
            return { ok: true, json: async () => ({ oldRating: 1500, newRating: 1500, change: 0 }) };
        };
        render(localized(React.createElement(PuzzleSession, { ...puzzleProps, hints: [] }), locale));
        assert.equal(screen.queryByRole('link', { name: messages[locale].Common.openLichessAnalysis }), null);
        await readyToSolve();
        assert.deepEqual(boardArrows(), []);
        await act(async () => fireEvent.click(screen.getByRole('button', { name: messages[locale].PuzzleSolver.showHint })));
        assert.deepEqual(boardArrows(), [], 'A concept clue must not reveal the answer arrow');
        assert(screen.getByText(messages[locale].LearningHelp.assisted));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: messages[locale].LearningHelp.moreHelp })));
        assert.deepEqual(boardArrows(), [], 'The second clue highlights only the piece');
        await act(async () => fireEvent.click(screen.getByRole('button', { name: messages[locale].LearningHelp.moreHelp })));
        assert.deepEqual(boardArrows(), expectedArrow('e7', 'e5'));
        assert.equal(requests.length, 1, 'Record assistance before completion or navigation');
        assert.deepEqual(JSON.parse(requests[0].init.body), { puzzleId: puzzleProps.id, success: false, hintUsed: true });
        await play('e7e5');
        assert.equal(requests.length, 1, 'No second result when finishing');
        assert.equal(readHistory()[0].result, 'hint');
        assert.equal(screen.queryByText(messages[locale].PuzzleSolver.puzzleSolved), null);
        assert(screen.getByText(messages[locale].PuzzleSolver.puzzleCompletedWithHint));
        assert.deepEqual(boardArrows(), []);
        const analysis = screen.getByRole('link', { name: messages[locale].Common.openLichessAnalysis });
        const finalFen = screen.getByTestId('board').getAttribute('data-position');
        assert.equal(analysis.href, `https://lichess.org/analysis/standard/${finalFen.replaceAll(' ', '_')}?color=black`);
        assert.equal(analysis.target, '_blank');
        assert.equal(analysis.rel, 'noopener noreferrer');
    });
}

test('the third mistake offers a concept clue; earlier mistakes keep their single existing penalty', async () => {
    render(localized(React.createElement(PuzzleSession, { ...puzzleProps, hints: [] }), 'en'));
    await readyToSolve();
    for (let count = 1; count <= 3; count++) {
        await wrongMove();
        assert.deepEqual(boardArrows(), []);
        if (count === 3) assert(screen.getByText(messages.en.LearningHelp.assisted));
    }
    assert.equal(requests.length, 1);
    assert.deepEqual(JSON.parse(requests[0].init.body), { puzzleId: puzzleProps.id, success: false });
    await play('e7e5');
    assert.equal(readHistory()[0].result, 'hint');
    assert(screen.getByText(messages.en.PuzzleSolver.puzzleCompletedWithHint));
    assert.equal(requests.length, 1);
});

test('reset preserves hint eligibility and replays the setup move', async () => {
    render(localized(React.createElement(PuzzleSession, puzzleProps), 'en'));
    await readyToSolve();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.PuzzleSolver.showHint })));
    await wrongMove();
    fireEvent.click(screen.getByRole('button', { name: messages.en.PuzzleSolver.reset }));
    assert.deepEqual(boardArrows(), []);
    await readyToSolve();
    await play('e7e5');
    assert.equal(readHistory()[0].result, 'hint');
    assert.equal(requests.length, 1, 'Reset or subsequent mistakes cannot rate a hinted attempt');
});

test('each player position gets its own next-move hint and mistake counter', async () => {
    render(localized(React.createElement(PuzzleSession, { ...puzzleProps, solution: 'e4 e5 Nf3 Nc6', hints: [] }), 'en'));
    await readyToSolve();
    await wrongMove();
    await wrongMove();
    await play('e7e5');
    assert.deepEqual(boardArrows(), []);
    assert.equal(screen.queryByRole('button', { name: messages.en.PuzzleSolver.showHint }), null, 'No hint during opponent reply');
    await waitFor(() => assert.equal(new Chess(screen.getByTestId('board').getAttribute('data-position')).get('f3')?.type, 'n'));
    await wrongMove();
    assert.deepEqual(boardArrows(), [], 'Mistakes at an earlier position do not trigger this position');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.PuzzleSolver.showHint })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.LearningHelp.moreHelp })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.LearningHelp.moreHelp })));
    assert.deepEqual(boardArrows(), expectedArrow('b8', 'c6'));
    await play('b8c6');
    assert.equal(readHistory()[0].result, 'hint');
    assert.equal(requests.length, 1);
});

for (const fixture of [
    { fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', solution: 'O-O O-O', from: 'e8', to: 'g8', san: 'O-O' },
    { fen: '7k/P7/8/8/8/8/8/7K b - - 0 1', solution: 'h8g8 a7a8n', from: 'a7', to: 'a8', san: 'a8=N' },
]) {
    test(`hint parsing supports ${fixture.san}`, async () => {
        render(localized(React.createElement(PuzzleSession, { ...puzzleProps, ...fixture, hints: [] }), 'en'));
        await waitFor(() => assert(screen.queryByRole('button', { name: messages.en.PuzzleSolver.showHint })));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.PuzzleSolver.showHint })));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.LearningHelp.moreHelp })));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.LearningHelp.moreHelp })));
        assert.deepEqual(boardArrows(), expectedArrow(fixture.from, fixture.to));
        assert(screen.getByText(`Play ${fixture.san}.`, { exact: false }));
    });
}

test('completion after an opponent reply keeps assistance and opens the final position for white', async () => {
    const board = new Chess();
    board.move('e4');
    render(localized(React.createElement(PuzzleSession, { ...puzzleProps, fen: board.fen(), solution: 'e5 Nf3 Nc6', hints: [] }), 'en'));
    await waitFor(() => assert(screen.queryByRole('button', { name: messages.en.PuzzleSolver.showHint })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.PuzzleSolver.showHint })));
    await play('g1f3');
    await waitFor(() => assert(screen.queryByText(messages.en.PuzzleSolver.puzzleCompletedWithHint)));
    assert.equal(readHistory()[0].result, 'hint');
    assert.equal(requests.length, 1);
    const link = screen.getByRole('link', { name: messages.en.Common.openLichessAnalysis });
    assert.equal(new URL(link.href).searchParams.get('color'), 'white');
    assert.equal(new URL(link.href).pathname.split('/').slice(3).join('/'), screen.getByTestId('board').getAttribute('data-position').replaceAll(' ', '_'));
});

test('moves are blocked during setup and reset cancels a pending opponent reply', async () => {
    render(localized(React.createElement(PuzzleSession, { ...puzzleProps, solution: 'e4 e5 Nf3 Nc6' }), 'en'));
    await play('e2e4');
    assert.equal(screen.getByTestId('board').getAttribute('data-position'), puzzleProps.fen);
    assert.equal(requests.length, 0);
    await readyToSolve();
    await play('e7e5');
    fireEvent.click(screen.getByRole('button', { name: messages.en.PuzzleSolver.reset }));
    await readyToSolve();
    const expected = new Chess();
    expected.move('e4');
    assert.equal(screen.getByTestId('board').getAttribute('data-position'), expected.fen());
    assert.equal(requests.length, 0);
    await play('e7e5');
    await waitFor(() => assert.equal(new Chess(screen.getByTestId('board').getAttribute('data-position')).get('f3')?.type, 'n'));
    await play('b8c6');
    assert.equal(readHistory()[0].result, 'success');
    assert.equal(requests.length, 1);
});

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

for (const locale of ['en', 'bg']) {
    test(`${locale}: conceptual hints do not leak legacy answer notes before the last stage`, async () => {
        render(localized(React.createElement(PuzzleSession, puzzleProps), locale));
        await readyToSolve();
        await act(async () => fireEvent.click(screen.getByRole('button', {name:messages[locale].PuzzleSolver.showHint})));
        assert.equal(screen.queryByText('Play e5'), null);
        await act(async () => fireEvent.click(screen.getByRole('button', {name:messages[locale].LearningHelp.moreHelp})));
        assert.equal(screen.queryByText('Play e5'), null);
        await act(async () => fireEvent.click(screen.getByRole('button', {name:messages[locale].LearningHelp.moreHelp})));
        assert(screen.getByText('Play e5'));
    });
}

test('review waits for persistence, offers retry after failure, and never navigates to a rated puzzle', async () => {
    let finishRequest;
    globalThis.fetch = async (input, init) => {
        requests.push({input,init});
        return new Promise(resolve => { finishRequest = resolve; });
    };
    const Review = loadSource('../src/components/PuzzleReviewSession.tsx', { ...common, './PuzzleSolver':PuzzleSolver, '@/lib/dailyMission':dailyMission }).default;
    render(localized(React.createElement(Review,{items:[
        {...puzzleProps,name:'current',tags:['fork'],fresh:false},
        {...puzzleProps,id:'fresh-id',name:'fresh-puzzle',tags:['middlegame','mateIn1','mateIn1'],fresh:true},
    ]}),'en'));
    assert(screen.getByRole('heading',{name:'current'}));
    assert(screen.getByText(messages.en.PuzzleCategories.fork));
    await readyToSolve();
    await play('e7e5');
    assert.equal(screen.getByRole('button',{name:messages.en.PuzzleSolver.nextPuzzle}).disabled,true);
    await act(async () => finishRequest({ok:false,text:async()=> 'Temporary failure'}));
    assert(screen.getByRole('alert'));
    assert.equal(screen.getByRole('button',{name:messages.en.PuzzleSolver.nextPuzzle}).disabled,true);
    await act(async () => fireEvent.click(screen.getByRole('button',{name:messages.en.LearningHelp.retrySave})));
    await act(async () => finishRequest({ok:true,json:async()=>({oldRating:1500,newRating:1500,change:0})}));
    assert.equal(screen.queryByRole('alert'),null);
    await act(async () => fireEvent.click(screen.getByRole('button',{name:messages.en.PuzzleSolver.nextPuzzle})));
    assert(screen.getByRole('heading',{name:'fresh-puzzle'}));
    assert.equal(screen.queryByRole('heading',{name:'current'}),null);
    assert.equal(screen.queryByText(messages.en.PuzzleCategories.fork),null);
    assert.equal(screen.getAllByText(messages.en.PuzzleCategories.mateIn1).length,1);
    assert(screen.getByText(messages.en.PuzzleCategories.middlegame));
    await readyToSolve();
    await play('e7e5');
    await act(async () => finishRequest({ok:true,json:async()=>({oldRating:1500,newRating:1500,change:0})}));
    await act(async () => fireEvent.click(screen.getByRole('button',{name:messages.en.PuzzleSolver.nextPuzzle})));
    assert(screen.getByText(messages.en.PuzzleReview.done));
    assert.deepEqual(JSON.parse(requests[0].init.body),{puzzleId:'current-id',success:true,review:true});
    assert.deepEqual(JSON.parse(requests[1].init.body),JSON.parse(requests[0].init.body));
    assert.equal(pushes.length,0);
});

const microLessons = loadSource('../src/lib/microLessons.ts', {'./puzzleLearning':puzzleLearning});
function LessonBoard({options}) {
    return React.createElement('div',{'data-testid':'board','data-position':options.position,'data-arrows':JSON.stringify(options.arrows)},
        ...['a5','h8','d8','d7','e8','a8'].map(square=>React.createElement('button',{key:square,onClick:()=>options.onSquareClick({square})},`square ${square}`)),
        ...Object.values(microLessons.MICRO_LESSONS).map(lesson=>React.createElement('button',{key:lesson.answer,onClick:()=>options.onPieceDrop({sourceSquare:lesson.answer.slice(0,2),targetSquare:lesson.answer.slice(2,4)})},lesson.answer)));
}
const MicroLesson = loadSource('../src/components/MicroLesson.tsx', {
    '@/lib/microLessons':microLessons, '@/lib/puzzleLearning':puzzleLearning,
    '@/hooks/useLegalMoves':loadSource('../src/hooks/useLegalMoves.ts'),
    './ReadAloud':loadSource('../src/components/ReadAloud.tsx').default,
    'react-chessboard':{Chessboard:LessonBoard},
}).default;
for (const locale of ['en','bg']) for (const [id,lesson] of Object.entries(microLessons.MICRO_LESSONS)) {
    test(`${locale}: ${id} lesson requires identifying targets, then solves its fresh challenge`, async () => {
        let practising = false;
        render(localized(React.createElement(MicroLesson,{lessonId:id,onPractice:()=> {practising=true;}}),locale));
        fireEvent.click(screen.getByRole('button',{name:messages[locale].MicroLessons.showExample}));
        assert.equal(screen.getByRole('button',{name:messages[locale].MicroLessons.tryYourself}).disabled,true);
        for (const square of lesson.targets) fireEvent.click(screen.getByRole('button',{name:`square ${square}`}));
        assert.equal(screen.getByRole('button',{name:messages[locale].MicroLessons.tryYourself}).disabled,false);
        fireEvent.click(screen.getByRole('button',{name:messages[locale].MicroLessons.tryYourself}));
        assert.equal(screen.getByTestId('board').getAttribute('data-position'),lesson.challenge);
        await act(async()=>fireEvent.click(screen.getByRole('button',{name:lesson.answer})));
        assert(screen.getByText(messages[locale].MicroLessons.complete));
        fireEvent.click(screen.getByRole('button',{name:messages[locale].MicroLessons.practice}));
        assert(practising);
        fireEvent.click(screen.getByRole('button',{name:messages[locale].MicroLessons.replay}));
        assert.equal(screen.getByTestId('board').getAttribute('data-position'),lesson.fen);
    });
}

test('move exploration handles engine failure and cancels its owned worker on close', async () => {
    const workers = [];
    const originalWorker = globalThis.Worker;
    globalThis.Worker = class {
        constructor() {workers.push(this);this.messages=[];this.terminated=false;}
        postMessage(message) {this.messages.push(message);}
        terminate() {this.terminated=true;}
    };
    try {
        const board = new Chess();board.move('e4');board.move('e5');
        render(localized(React.createElement(learningComponents['@/components/MoveConsequence'],{fen:board.fen(),move:'g1f3'}),'en'));
        fireEvent.click(screen.getByRole('button',{name:messages.en.LearningHelp.explore}));
        assert.equal(workers.length,1);
        assert(workers[0].messages.includes('go depth 8'));
        await act(async()=>workers[0].onmessage({data:'bestmove b8c6'}));
        assert(workers[0].terminated);
        fireEvent.click(screen.getByRole('button',{name:messages.en.LearningHelp.showReply}));
        const expected = new Chess(board.fen());expected.move('Nf3');expected.move('Nc6');
        assert.equal(screen.getByTestId('board').getAttribute('data-position'),expected.fen());
        fireEvent.click(screen.getByRole('button',{name:messages.en.LearningHelp.close}));
        fireEvent.click(screen.getByRole('button',{name:messages.en.LearningHelp.explore}));
        await act(async()=>workers[1].onerror());
        assert(screen.getByText(messages.en.LearningHelp.unavailable));
        assert(workers[1].terminated);
    } finally {globalThis.Worker=originalWorker;}
});

const LevelExerciseBoard = loadSource('../src/components/LevelExerciseBoard.tsx', {
    '@/lib/levelExercises':loadSource('../src/lib/levelExercises.ts',{'./curriculum':loadSource('../src/lib/curriculum.ts')}),
    '@/lib/puzzleLearning':puzzleLearning,
    '@/hooks/useLearningAttempt':loadSource('../src/hooks/useLearningAttempt.ts'),
    './ProgressiveHint':learningComponents['@/components/ProgressiveHint'],
    './MoveConsequence':learningComponents['@/components/MoveConsequence'],
    'react-chessboard':{Chessboard:LessonBoard},
}).default;
for (const locale of ['en','bg']) for (const hinted of [true,false]) {
    test(`${locale}: level exercise with hinted=${hinted} contributes one unrated puzzle result`,async()=>{
        const lesson=microLessons.MICRO_LESSONS.safeCapture;
        let credit;
        render(localized(React.createElement(LevelExerciseBoard,{exercise:{id:'round-1',puzzleId:'database-puzzle',fen:lesson.challenge,moves:[lesson.answer],theme:'hangingPiece'},onContinue:value=>{credit=value;},last:false}),locale));
        if(hinted) {
            await act(async()=>fireEvent.click(screen.getByRole('button',{name:messages[locale].LearningHelp.hint})));
            assert.deepEqual(boardArrows(),[]);
            await act(async()=>fireEvent.click(screen.getByRole('button',{name:messages[locale].LearningHelp.moreHelp})));
            assert.deepEqual(boardArrows(),[]);
            await act(async()=>fireEvent.click(screen.getByRole('button',{name:messages[locale].LearningHelp.moreHelp})));
            assert.equal(boardArrows()[0].startSquare,'b1');
        }
        await act(async()=>fireEvent.click(screen.getByRole('button',{name:lesson.answer})));
        assert.equal(requests.length,1);
        assert.deepEqual(JSON.parse(requests[0].init.body),{puzzleId:'database-puzzle',success:!hinted,hintUsed:hinted,review:true});
        fireEvent.click(screen.getByRole('button',{name:messages[locale].LevelExercises.nextExercise}));
        assert.equal(credit,!hinted);
    });
}

for (const locale of ['en', 'bg']) test(`${locale}: an empty rating band shows limits and a localized topic link without selecting an easier puzzle`, async () => {
    globalThis.fetch = async (input, init) => {
        requests.push({ url: new URL(input, window.location.origin), init });
        return { ok: true, json: async () => ({ puzzleName: null, range: { min: 1363, max: 1663 } }) };
    };
    render(localized(React.createElement(PuzzlePlayPage), locale, new URLSearchParams({ tag })));
    await screen.findByRole('status');
    assert(screen.getByRole('status').textContent.includes('1363–1663'));
    assert.equal(pushes.length, 0);
    const link = screen.getByRole('link', { name: messages[locale].PuzzleDifficulty.chooseTopic });
    assert.equal(link.getAttribute('href'), `/${locale}/puzzles`);
    fireEvent.click(screen.getByRole('button', { name: messages[locale].PuzzleDifficulty.tryAgain }));
    await waitFor(() => assert.equal(requests.length, 2));
    assert(requests.every(request => request.url.searchParams.get('tag') === tag));
    assert(requests.every(request => request.url.searchParams.get('rating') === null));
});
