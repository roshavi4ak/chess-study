/* eslint-disable @typescript-eslint/no-require-imports -- Real React and chess rules with isolated persistence. */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/en/puzzles/test' });
for (const key of ['window', 'self', 'document', 'navigator', 'HTMLElement', 'Node', 'Event']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, screen, within, fireEvent, waitFor, act, cleanup } = require('@testing-library/react');
const { NextIntlClientProvider, createTranslator } = require('next-intl');
const { Chess } = require('chess.js');
const { sourceLoader } = require('./test-support/chessnut.cjs');
const messages = Object.fromEntries(['en', 'bg'].map(locale => [locale, require(`../messages/${locale}.json`)]));
let session, writes, records, requests, locale;
const originalFetch = globalThis.fetch;
const initial = new Chess().fen();
const setup = new Chess(); setup.move('e4');
const mistake = { ply: 1, fen: setup.fen(), played: 'd7d5', expected: ['e7e5'] };
const puzzle = { id: 'puzzle', name: 'Example', fen: initial, solution: 'e2e4 e7e5 g1f3 b8c6', rating: 1500, ratingDeviation: 350, volatility: 0.06, tags: ['fork'] };
const students = [{ id: 'student', name: 'Alice', role: 'STUDENT' }, { id: 'second', name: 'Boris', role: 'STUDENT' }, { id: 'foreign', name: 'Coach', role: 'COACH' }];
function board({ options }) {
    const game = new Chess(options.position);
    return React.createElement('div', { 'data-testid': options.id, 'data-position': options.position, 'data-arrows': JSON.stringify(options.arrows ?? []) },
        game.moves({ verbose: true }).map(move => React.createElement('button', { key: move.lan, onClick: () => options.onPieceDrop?.({ sourceSquare: move.from, targetSquare: move.to }) }, move.lan)));
}
const prisma = {
    user: {
        findUnique: async () => ({ ratingPuzzle: 1500, puzzleRd: 350, puzzleVolatility: 0.06 }),
        findFirst: async ({ where }) => students.find(student => student.id === where.id && student.role === where.role) ?? null,
        update: async args => { writes.push({ table: 'user', ...args }); },
    },
    puzzle: { findUnique: async () => puzzle, update: async args => { writes.push({ table: 'puzzle', ...args }); } },
    puzzleAttempt: {
        findFirst: async ({ where }) => records.find(row => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null,
        findMany: async ({ where }) => records.filter(row => row.puzzleId === where.puzzleId && row.success === where.success && students.some(student => student.id === row.userId && student.role === where.user.role)).map(row => ({ ...row, user: students.find(student => student.id === row.userId) })),
        create: async ({ data }) => { const row = { id: `attempt-${records.length}`, createdAt: new Date(), puzzle, ...data }; records.push(row); writes.push({ table: 'attempt', data }); return row; },
        update: async ({ where, data }) => { const row = records.find(item => item.id === where.id); Object.assign(row, data); writes.push({ table: 'attemptUpdate', data }); return row; },
    },
    userTagStats: { upsert: async args => { writes.push({ table: 'tags', ...args }); } },
    playSession: { findFirst: async () => null },
};
const load = sourceLoader({
    '@/auth': { auth: async () => session },
    '@/lib/db': { prisma },
    '@/i18n/navigation': { Link: ({ href, children, prefetch, ...props }) => React.createElement('a', { href, 'data-prefetch': String(prefetch), ...props }, children), useRouter: () => ({ push() {} }) },
    'next/server': { NextResponse: Response },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); }, redirect: () => { throw new Error('REDIRECT'); } },
    'next-intl/server': { getLocale: async () => locale, getTranslations: async namespace => createTranslator({ locale, messages: messages[locale], namespace }) },
    'react-chessboard': { Chessboard: board },
    '@/components/MoveConsequence': () => null,
    '@/hooks/useActivityChessnut': { useActivityChessnut: () => ({ enabled: false, ready: true }) },
    './ActivityBoardPanel': () => null,
});
const rules = load('src/lib/attemptMoves.ts');
const { POST, PATCH } = load('src/app/api/puzzles/submit/route.ts');
const { loadPuzzleMistakes } = load('src/lib/attemptReview.ts');
const Review = load('src/components/AttemptReview.tsx').default;
const Solver = load('src/components/PuzzleSolver.tsx').default;
const ReviewPage = load('src/app/[locale]/coach/students/[id]/activity/[kind]/[attemptId]/page.tsx').default;
const wrap = child => React.createElement(NextIntlClientProvider, { locale, messages: messages[locale], timeZone: 'Europe/Sofia' }, child);
const send = (method, body) => (method === 'POST' ? POST : PATCH)(new Request('http://localhost/api/puzzles/submit', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const drop = async uci => act(async () => fireEvent.click(within(screen.getByTestId('puzzle-solver')).getByRole('button', { name: uci })));
beforeEach(() => {
    session = { user: { id: 'student' } }; locale = 'en'; writes = []; records = []; requests = [];
    globalThis.fetch = async (_input, init) => {
        requests.push(init);
        return send(init.method, JSON.parse(init.body));
    };
});
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

for (const [fen, expected, alternatives] of [
    ['7k/5Q2/6K1/8/8/8/8/8 w - - 0 37', 'f7g7', ['f7f8', 'f7e8']],
    ['8/8/8/8/8/6k1/5q2/7K b - - 0 37', 'f2g2', ['f2f1', 'f2e1']],
    ['7k/5P2/6K1/8/8/8/8/8 w - - 0 37', 'f7f8q', ['f7f8r']],
]) test(`every final mating alternative is accepted in ${fen}`, () => {
    for (const uci of alternatives) {
        const game = new Chess(fen); const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        assert(game.isCheckmate(), `${uci} is actually mate`);
        assert(rules.isPuzzleMoveCorrect(move, game, expected, true));
        assert(!rules.isPuzzleMoveCorrect(move, game, expected, false), 'Only the final move permits a different solution');
    }
});

test('a check or stalemate is never accepted as an alternative final mate', () => {
    const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 37');
    const move = game.move('Qf6+');
    assert(!game.isCheckmate());
    assert(!rules.isPuzzleMoveCorrect(move, game, 'f7g7', true));
});

test('mistake validation preserves repeated tries and takes expected moves from the puzzle', () => {
    const actual = rules.puzzleMoveErrors(initial, puzzle.solution, [{ ...mistake, expected: ['invented'] }, mistake]);
    assert.deepEqual(actual, [mistake, mistake]);
    assert.equal(rules.describeMove(mistake.fen, mistake.played).label, '1… d5');
    for (const invalid of [[{ ...mistake, ply: 2 }], [{ ...mistake, fen: initial }], [{ ...mistake, played: 'e7e5' }], [{ ...mistake, played: 'e7e1' }], [null], 'bad']) {
        assert.throws(() => rules.puzzleMoveErrors(initial, puzzle.solution, invalid));
    }
});

test('first mistake records one result; further mistakes update it without rating or activity inflation', async () => {
    const response = await send('POST', { puzzleId: 'puzzle', success: false, moveErrors: [mistake] });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert(result.change < 0);
    const before = writes.length;
    assert.equal((await send('PATCH', { attemptId: result.attemptId, moveErrors: [mistake, mistake] })).status, 200);
    assert.deepEqual(writes.slice(before).map(row => row.table), ['attemptUpdate']);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].moveErrors, [mistake, mistake]);
});

test('hint first followed by a mistake keeps the original unrated attempt', async () => {
    const result = await (await send('POST', { puzzleId: 'puzzle', success: false, hintUsed: true, moveErrors: [] })).json();
    assert.equal(result.change, 0);
    await send('PATCH', { attemptId: result.attemptId, moveErrors: [mistake] });
    assert.deepEqual(writes.map(row => row.table), ['attempt', 'tags', 'attemptUpdate']);
});

test('mistakes cannot be written to another student’s attempt or a successful result', async () => {
    records.push({ id: 'foreign', userId: 'foreign', success: false, puzzle }, { id: 'success', userId: 'student', success: true, puzzle });
    for (const attemptId of ['foreign', 'success', 'missing']) assert.equal((await send('PATCH', { attemptId, moveErrors: [mistake] })).status, 404);
    assert.equal(writes.length, 0);
    session = null;
    assert.equal((await send('PATCH', { attemptId: 'foreign', moveErrors: [] })).status, 401);
});

test('bad mistake payloads fail before changing ratings', async () => {
    for (const body of [null, { puzzleId: 'puzzle', success: true, moveErrors: [mistake] }, { puzzleId: 'puzzle', success: false, moveErrors: [{ ...mistake, played: 'e7e5' }] }]) {
        assert.equal((await send('POST', body)).status, 400);
        assert.equal(writes.length, 0);
    }
});

test('a puzzle review combines all students and all failed attempts, excluding coach accounts', async () => {
    records = students.map((student, index) => ({ id: String(index), userId: student.id, puzzleId: 'puzzle', success: false, createdAt: new Date(), moveErrors: index === 0 ? null : [mistake] }));
    records.push({ ...records[0], id: 'solved', success: true });
    const attempts = await loadPuzzleMistakes('puzzle');
    assert.deepEqual(attempts.map(row => row.student), ['Alice', 'Boris']);
    assert.equal(attempts[0].errors, null);
    assert.deepEqual(attempts[1].errors, [mistake]);
    assert.deepEqual(await loadPuzzleMistakes('unknown-puzzle'), []);
});

test('activity URLs require a coach and cannot open coach accounts or another student’s attempt', async () => {
    session.user.role = 'COACH';
    records.push({ id: 'foreign-attempt', userId: 'foreign', puzzle });
    await assert.rejects(ReviewPage({ params: Promise.resolve({ id: 'foreign', kind: 'puzzle', attemptId: 'foreign-attempt' }) }), /NOT_FOUND/);
    await assert.rejects(ReviewPage({ params: Promise.resolve({ id: 'student', kind: 'puzzle', attemptId: 'foreign-attempt' }) }), /NOT_FOUND/);
    session = null;
    await assert.rejects(ReviewPage({ params: Promise.resolve({ id: 'student', kind: 'puzzle', attemptId: 'foreign-attempt' }) }), /REDIRECT/);
});

for (const language of ['en', 'bg']) test(`${language}: the review board jumps to each mistake, shows the actual wrong move, and replays the correct line`, () => {
    locale = language;
    render(wrap(React.createElement(Review, { fen: initial, moves: ['e2e4', 'e7e5'], title: 'Review', attempts: [
        { id: 'a', student: 'Alice', at: new Date().toISOString(), success: false, errors: [mistake, mistake] },
        { id: 'b', student: 'Boris', at: new Date().toISOString(), success: false, errors: null },
    ] })));
    assert.equal(screen.getByTestId('attempt-review').getAttribute('data-position'), mistake.fen);
    assert(screen.getByText(messages[locale].AttemptReview.legacy));
    fireEvent.click(screen.getByRole('button', { name: messages[locale].AttemptReview.show_played }));
    const wrong = new Chess(mistake.fen); wrong.move('d5');
    assert.equal(screen.getByTestId('attempt-review').getAttribute('data-position'), wrong.fen());
    fireEvent.click(screen.getByRole('button', { name: messages[locale].AttemptReview.show_expected }));
    const correct = new Chess(mistake.fen); correct.move('e5');
    assert.equal(screen.getByTestId('attempt-review').getAttribute('data-position'), correct.fen());
    fireEvent.click(screen.getByRole('button', { name: messages[locale].AttemptReview.solution }));
    assert.equal(screen.getByTestId('attempt-review').getAttribute('data-position'), initial);
    fireEvent.click(screen.getByRole('button', { name: messages[locale].AttemptReview.next }));
    assert.equal(screen.getByTestId('attempt-review').getAttribute('data-position'), setup.fen());
});

test('the actual puzzle solver accepts an alternative final checkmate without recording a mistake', async () => {
    render(wrap(React.createElement(Solver, { id: 'mate', name: 'Mate', fen: '6k1/5Q2/6K1/8/8/8/8/8 b - - 0 36', solution: 'g8h8 f7g7' })));
    await waitFor(() => assert.equal(new Chess(screen.getByTestId('puzzle-solver').getAttribute('data-position')).turn(), 'w'));
    await drop('f7f8');
    await waitFor(() => assert.equal(requests.length, 1));
    assert.equal(JSON.parse(requests[0].body).success, true);
    assert.deepEqual(JSON.parse(requests[0].body).moveErrors, []);
    assert(new Chess(screen.getByTestId('puzzle-solver').getAttribute('data-position')).isCheckmate());
});

test('multiple puzzle mistakes during a slow initial save all reach the same attempt', async () => {
    let resolveFirst;
    globalThis.fetch = async (_url, init) => {
        requests.push(init);
        if (init.method === 'POST') return new Promise(resolve => { resolveFirst = async () => resolve(await send('POST', JSON.parse(init.body))); });
        return send('PATCH', JSON.parse(init.body));
    };
    render(wrap(React.createElement(Solver, { ...puzzle, solution: 'e2e4 e7e5' })));
    await waitFor(() => assert.equal(new Chess(screen.getByTestId('puzzle-solver').getAttribute('data-position')).turn(), 'b'));
    await drop('d7d5');
    await waitFor(() => assert(!screen.queryByText(messages.en.PuzzleSolver.incorrectMove)), { timeout: 2000 });
    await drop('c7c5');
    await act(async () => resolveFirst());
    await waitFor(() => assert.equal(records[0]?.moveErrors.length, 2));
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].moveErrors.map(error => error.played), ['d7d5', 'c7c5']);
    assert.deepEqual(requests.map(request => request.method), ['POST', 'PATCH']);
});

test('practice saves retain every wrong move and cannot mark an attempt with recorded mistakes as perfect', async () => {
    const nodes = [
        { id: 'root', parentId: null, fen: initial, move: null },
        { id: 'leaf', parentId: 'root', fen: setup.fen(), move: 'e2e4' },
    ];
    const loadProgress = sourceLoader({
        '@/auth': { auth: async () => session },
        'next/cache': { revalidatePath() {} },
        '@/lib/db': { prisma: {
            practiceNode: { findMany: async () => nodes },
            practiceLineProgress: { findUnique: async () => null, create: async () => ({}) },
            practiceAttempt: { create: async ({ data }) => { writes.push(data); } },
            $transaction: tasks => Promise.all(tasks),
        } },
    });
    const { saveLineProgress } = loadProgress('src/app/actions/progress.ts');
    const wrong = { ply: 0, fen: initial, played: 'd2d4', expected: ['e2e4'] };
    await saveLineProgress({ practiceId: 'practice', nodeId: 'leaf', hadWrongMoves: false, completed: true, coachNotesVisible: false, moveErrors: [wrong, wrong] });
    assert.equal(writes[0].status, 'COMPLETED');
    assert.equal(writes[0].mistakes, 2);
    assert.deepEqual(writes[0].moveErrors, [wrong, wrong]);
    await assert.rejects(saveLineProgress({ practiceId: 'practice', nodeId: 'leaf', hadWrongMoves: true, completed: true, coachNotesVisible: false,
        moveErrors: [{ ...wrong, played: 'e2e4' }] }), /Correct move/);
    assert.equal(writes.length, 1);
});

test('level reviews preserve exact errors and notation answers; forged correct moves are rejected', () => {
    const review = { fen: initial, moves: ['e2e4'], success: false, errors: [{ ply: 0, fen: initial, played: 'd2d4', expected: ['e2e4'] }] };
    assert.deepEqual(rules.validateExerciseReviews([review]), [review]);
    const notation = { ...review, errors: [], answer: { played: 'e3', expected: 'e4' } };
    assert.deepEqual(rules.validateExerciseReviews([notation]), [notation]);
    assert.throws(() => rules.validateExerciseReviews([{ ...review, success: true }]));
    assert.throws(() => rules.validateExerciseReviews([{ ...review, errors: [{ ...review.errors[0], played: 'e2e4' }] }]));
});

test('level exercises accept an alternate final mate even in an endgame theme', () => {
    const { startExercise, attemptExerciseMove } = load('src/lib/levelExercises.ts');
    const exercise = { id: 'mate', fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 37', moves: ['f7g7'], theme: 'endgame' };
    const attempt = attemptExerciseMove(exercise, startExercise(exercise), { from: 'f7', to: 'f8' });
    assert.equal(attempt.status, 'complete');
    assert.equal(attempt.mistakes, 0);
});

for (const language of ['en', 'bg']) test(`${language}: opening practice accepts an alternative final mate and shows the actual move on replay`, async () => {
    locale = language;
    const before = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 37';
    const stored = new Chess(before); stored.move('Qg7#');
    const leaf = { id: 'mate-leaf', fen: stored.fen(), move: 'f7g7', children: [], notes: null, lineNumber: 1 };
    const tree = { id: 'mate-root', fen: before, move: null, children: [leaf], notes: null };
    const loadPractice = sourceLoader({
        'react-chessboard': { Chessboard: board },
        '@/hooks/useChessnutBoard': { useChessnutBoard: () => ({ enabled: false }) },
        '@/components/ChessnutBoardPanel': () => null,
        '@/components/WhyQuestionCard': () => null,
        '@/i18n/navigation': { Link: ({ href, children }) => React.createElement('a', { href }, children) },
        '@/app/actions/progress': { saveLineProgress: async input => { writes.push(input); } },
    });
    const Practice = loadPractice('src/components/PracticeSession.tsx').default;
    render(wrap(React.createElement(Practice, { practice: { id: 'mate-practice', name: 'Mate ending', description: null, playerColor: 'WHITE', creatorName: 'Coach', tree },
        initialProgress: [{ nodeId: leaf.id, status: 'PERFECT', attempts: 1, perfectCount: 1 }] })));
    await act(async () => fireEvent.click(within(screen.getByTestId('practice-session-board')).getByRole('button', { name: 'f7f8' })));
    await waitFor(() => assert.equal(writes.length, 1));
    assert.equal(writes[0].hadWrongMoves, false);
    assert.equal(writes[0].mistakes, 0);
    assert.equal(writes[0].finalMove, 'f7f8');
    assert.equal(writes[0].nodeId, leaf.id);
    const actual = new Chess(before); actual.move('Qf8#');
    assert.equal(screen.getByTestId('practice-session-board').getAttribute('data-position'), actual.fen());
    fireEvent.click(screen.getByRole('button', { name: messages[locale].Practice.previousMove }));
    assert.equal(screen.getByTestId('practice-session-board').getAttribute('data-position'), before);
    fireEvent.click(screen.getByRole('button', { name: messages[locale].Practice.forwardMove }));
    assert.equal(screen.getByTestId('practice-session-board').getAttribute('data-position'), actual.fen());
});

test('the server accepts an alternate terminal opening checkmate, rejects non-mates and non-terminal substitutions', async () => {
    const before = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 37';
    let children = [];
    const loadProgress = sourceLoader({
        '@/auth': { auth: async () => session }, 'next/cache': { revalidatePath() {} },
        '@/lib/db': { prisma: {
            practiceNode: { findFirst: async () => ({ move: 'f7g7', parent: { fen: before }, children }) },
            practiceLineProgress: { findUnique: async () => null, create: async () => ({}) },
            practiceAttempt: { create: async ({ data }) => { writes.push(data); } }, $transaction: tasks => Promise.all(tasks),
        } },
    });
    const { saveLineProgress } = loadProgress('src/app/actions/progress.ts');
    const input = { practiceId: 'p', nodeId: 'leaf', hadWrongMoves: false, completed: true, coachNotesVisible: false, finalMove: 'f7f8' };
    await saveLineProgress(input);
    assert.equal(writes[0].status, 'PERFECT');
    assert.equal(writes[0].finalMove, 'f7f8');
    await assert.rejects(saveLineProgress({ ...input, finalMove: 'f7f6' }), /Invalid final move/);
    children = [{ id: 'continuation' }];
    await assert.rejects(saveLineProgress(input), /Unknown practice line/);
    assert.equal(writes.length, 1);
});

test('a hint followed by wrong moves in a level exercise updates one puzzle attempt', async () => {
    const LevelBoard = load('src/components/LevelExerciseBoard.tsx').default;
    render(wrap(React.createElement(LevelBoard, { exercise: { id: 'level-example', puzzleId: puzzle.id, fen: setup.fen(), moves: puzzle.solution.split(' ').slice(1), theme: 'tactics' }, onContinue() {}, last: false })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: messages.en.LearningHelp.hint })));
    await waitFor(() => assert.equal(records.length, 1));
    await act(async () => fireEvent.click(within(screen.getByTestId('level-exercise')).getByRole('button', { name: 'd7d5' })));
    await waitFor(() => assert.equal(records[0].moveErrors.length, 1));
    assert.equal(records.length, 1);
    assert.deepEqual(requests.map(request => request.method), ['POST', 'PATCH']);
    assert(!writes.some(row => row.table === 'user' || row.table === 'puzzle'));
});

test('student timelines and recent puzzle rows link to the specific recorded attempt', async () => {
    const at = new Date('2026-10-28T10:00:00Z');
    const loadProfile = sourceLoader({
        '@/lib/db': { prisma: {
            user: { findFirst: async () => ({ ...students[0], image: null, lichessId: null, startLevel: null, ratingPuzzle: 1500, ratingBullet: null, ratingBlitz: null, ratingRapid: null, ratingClassical: null }) },
            practiceAttempt: { findMany: async () => [] },
            puzzleAttempt: { findMany: async () => [{ id: 'exact-puzzle-attempt', success: false, points: -10, createdAt: at, puzzle }] },
            playSession: { findMany: async () => [{ id: 'exact-level-attempt', kind: 'LEVEL_TEST', key: 'level:pawn-1', score: 4, won: false, details: null, createdAt: at }] },
            openingProgress: { findMany: async () => [] }, gameRecord: { findMany: async () => [] }, assignment: { findMany: async () => [] },
            leagueMembership: { findUnique: async () => null }, practice: { findMany: async () => [] },
        } },
        '@/lib/levelProgress': { loadLevel: async () => ({ currentId: 'pawn-1', currentIndex: 0, passed: [], kingPasses: 0, kingRating: 1000, best: {} }) },
    });
    const profile = await loadProfile('src/lib/studentProfile.ts').loadStudentProfile('student');
    assert.equal(profile.recentPuzzles[0].attemptId, 'exact-puzzle-attempt');
    assert.deepEqual(profile.timeline.map(event => event.id).sort(), ['exact-level-attempt', 'exact-puzzle-attempt']);
    const loadPage = sourceLoader({
        '@/lib/studentProfile': { loadStudentProfile: async () => profile },
        '@/lib/attemptReview': { activityReviewHref: (id, kind, attemptId) => `/coach/students/${id}/activity/${kind}/${attemptId}` },
        '@/auth': { auth: async () => ({ user: { id: 'coach', role: 'COACH' } }) },
        '@/app/actions/assignments': { getAssignmentOptions: async () => ({ practices: [], tags: [] }) },
        '@/components/StartLevelSelect': () => null, '@/components/StudentHomeworkPanel': () => null,
        '@/components/DeleteAssignmentButton': () => null, '@/components/PuzzleDifficultySettings': () => null,
        '@/i18n/navigation': { Link: ({ href, children, prefetch, ...props }) => React.createElement('a', { href, 'data-prefetch': String(prefetch), ...props }, children) },
        'next-intl/server': { getLocale: async () => locale, getTranslations: async namespace => createTranslator({ locale, messages: messages[locale], namespace }) },
        'next/navigation': { notFound() { throw new Error('NOT_FOUND'); }, redirect() { throw new Error('REDIRECT'); } },
    });
    const page = await loadPage('src/app/[locale]/coach/students/[id]/page.tsx').default({ params: Promise.resolve({ id: 'student' }) });
    const { container } = render(wrap(page));
    const timelineLinks = [...container.querySelectorAll('#timeline ol a')];
    assert.equal(timelineLinks.length, 2);
    assert.deepEqual(timelineLinks.map(link => link.getAttribute('href')).sort(), [
        '/coach/students/student/activity/play/exact-level-attempt', '/coach/students/student/activity/puzzle/exact-puzzle-attempt',
    ]);
    assert(timelineLinks.every(link => link.dataset.prefetch === 'false'));
});
