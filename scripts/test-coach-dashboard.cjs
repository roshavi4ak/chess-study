/* eslint-disable @typescript-eslint/no-require-imports -- Exercise query building and the real filter component without a Next server. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test, afterEach } = require('node:test');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/bg/coach/dashboard' });
for (const key of ['window', 'self', 'document', 'navigator', 'HTMLElement', 'HTMLSelectElement', 'Node', 'Event', 'FormData']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, screen, fireEvent, cleanup, waitFor, within } = require('@testing-library/react');
const { NextIntlClientProvider } = require('next-intl');
const navigation = [];
const dbMock = {};
const cache = new Map();
function loadSource(relative) {
    const file = path.resolve(__dirname, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module);
    cache.set(file, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    const original = mod.require.bind(mod);
    mod.require = name => {
        if (name === '@/lib/db') return { prisma: dbMock };
        if (name === '@/i18n/navigation') return {
            Link: ({ href, children, ...props }) => { delete props.scroll; return React.createElement('a', { href, ...props }, children); },
            useRouter: () => ({ push: (url, options) => navigation.push({ url, options }) }),
        };
        if (name.startsWith('@/')) return loadSource(`../src/${name.slice(2)}.ts`);
        if (name.startsWith('./')) return loadSource(path.relative(__dirname, path.resolve(path.dirname(file), `${name}.ts`)));
        return original(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
    return mod.exports;
}
const dashboard = loadSource('../src/lib/coachDashboard.ts');
const { dashboardActivityQuery, loadDashboardTeams } = loadSource('../src/lib/coachDashboardData.ts');
const Filters = loadSource('../src/components/CoachDashboardFilters.tsx').default;
const students = [{ id: 'one', name: 'Мелиса' }, { id: 'two', name: 'Martin' }, { id: 'three', name: 'Никола' }];
const teams = [{ id: 'club:1', name: 'Сини', memberIds: ['one', 'two'] }, { id: 'challenge:2', name: 'Червени · Октомври', memberIds: ['three'] }];
afterEach(() => { cleanup(); navigation.length = 0; });

test('untrusted URL values are normalized and page numbers are bounded', () => {
    const defaults = dashboard.parseDashboardFilters({ view: ['activity'], activity: 'bad', result: 'bad', period: 'never', student: ['one'], page: 'Infinity' });
    assert.deepEqual(defaults, { view: 'students', activity: 'all', result: 'all', period: 'all', student: '', team: '', q: '', page: 1 });
    for (const page of ['-3', '1.2', '0', '9007199254740993']) assert.equal(dashboard.parseDashboardFilters({ page }).page, 1);
    assert.equal(dashboard.parseDashboardFilters({ q: `  ${'x'.repeat(200)} ` }).q.length, 100);
    assert.deepEqual(dashboard.dashboardPagination(26, 999), { page: 3, pages: 3, skip: 20, from: 21, to: 26 });
    assert.deepEqual(dashboard.dashboardPagination(0, 10), { page: 1, pages: 1, skip: 0, from: 0, to: 0 });
});

test('student, saved team, challenge team and name filters intersect before pagination', () => {
    const filter = params => dashboard.filterDashboardStudents(students, teams, dashboard.parseDashboardFilters(params)).map(s => s.id);
    assert.deepEqual(filter({ team: 'club:1', q: 'мЕЛ' }), ['one']);
    assert.deepEqual(filter({ team: 'challenge:2' }), ['three']);
    assert.deepEqual(filter({ team: 'club:1', student: 'three' }), []);
    assert.deepEqual(filter({ team: 'deleted' }), []);
    assert.deepEqual(filter({ student: 'missing' }), []);
    assert.deepEqual(filter({ view: 'activity', team: 'club:1', q: 'Vienna Gambit' }), ['one', 'two'], 'activity search belongs in the full-history database query');
});

test('view, pagination and drill-down URLs preserve filters and encode values safely', () => {
    const filters = dashboard.parseDashboardFilters({ view: 'activity', team: 'club:1', student: 'one', q: 'пъзел & мат', activity: 'puzzle', result: 'failed', period: '7', page: '3' });
    const url = new URL(dashboard.dashboardHref(filters, { page: 2 }), 'http://localhost');
    for (const key of ['team', 'student', 'q', 'activity', 'result', 'period']) assert.equal(url.searchParams.get(key), filters[key]);
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(dashboard.dashboardHref(dashboard.parseDashboardFilters({})), '/coach/dashboard');
});

test('attention includes overdue homework even when activity and backlog are healthy', () => {
    assert.equal(dashboard.needsAttention({ summary: { flags: [] }, homework: [{ overdue: true }] }), true);
    assert.equal(dashboard.needsAttention({ summary: { flags: ['inactive'] }, homework: [] }), true);
    assert.equal(dashboard.needsAttention({ summary: { flags: [] }, homework: [] }), false);
});

test('full-history SQL binds names, membership and dates rather than interpolating search input', () => {
    const q = "%' OR 1=1; --";
    const query = dashboardActivityQuery(dashboard.parseDashboardFilters({ view: 'activity', q, activity: 'puzzle', result: 'failed', period: '7' }), ['one'], new Date('2026-10-22T12:00:00Z'));
    assert(!query.text.includes(q));
    assert(query.values.includes(q));
    assert(query.values.some(v => v instanceof Date && v.toISOString() === '2026-10-15T12:00:00.000Z'));
    assert(query.text.includes('UNION ALL'));
    assert(query.text.includes('a.success = FALSE'));
    assert(!query.text.includes('LIMIT 100'));
    const empty = dashboardActivityQuery(dashboard.parseDashboardFilters({}), []);
    assert.equal((empty.text.match(/WHERE FALSE/g) ?? []).length, 2);
});

test('team choices distinguish saved rosters and challenge snapshots and tolerate only a missing optional roster table', async () => {
    const { Prisma } = require('@prisma/client');
    dbMock.clubTeam = { findMany: async () => [{ id: '1', name: 'Blue', members: [{ userId: 'one' }] }] };
    dbMock.challengeTeam = { findMany: async () => [{ id: '1', name: 'Blue', members: [{ userId: 'two' }], challenge: { name: 'October Cup' } }] };
    assert.deepEqual(await loadDashboardTeams(), [
        { id: 'club:1', name: 'Blue', memberIds: ['one'] },
        { id: 'challenge:1', name: 'Blue · October Cup', memberIds: ['two'] },
    ]);
    dbMock.clubTeam.findMany = async () => { throw new Prisma.PrismaClientKnownRequestError('missing optional roster', { code: 'P2021', clientVersion: 'test' }); };
    assert.equal((await loadDashboardTeams()).length, 1);
    dbMock.clubTeam.findMany = async () => { throw new Error('connection failed'); };
    await assert.rejects(loadDashboardTeams(), /connection failed/);
});

for (const locale of ['en', 'bg']) test(`${locale}: filters navigate immediately, reset pagination and preserve combined selections`, async () => {
    const messages = require(`../messages/${locale}.json`);
    const t = messages.CoachDashboard;
    const filters = dashboard.parseDashboardFilters({ view: 'activity', student: 'one', page: '8', result: 'solved' });
    render(React.createElement(NextIntlClientProvider, { locale, messages, timeZone: 'Europe/Sofia' }, React.createElement(Filters, { filters, students, teams })));
    const form = screen.getByRole('form', { name: t.filters });
    const expand = within(form).getByRole('button', { name: `${t.moreFilters} (2)` });
    assert.equal(expand.getAttribute('aria-expanded'), 'false');
    fireEvent.click(expand);
    assert.equal(within(form).getByRole('button', { name: `${t.fewerFilters} (2)` }).getAttribute('aria-expanded'), 'true');
    fireEvent.change(within(form).getByRole('combobox', { name: t.team }), { target: { value: 'club:1' } });
    await waitFor(() => assert.equal(navigation.length, 1));
    let url = new URL(navigation.at(-1).url, 'http://localhost');
    assert.equal(url.searchParams.get('team'), 'club:1');
    assert.equal(url.searchParams.get('student'), 'one');
    assert.equal(url.searchParams.get('page'), null);
    fireEvent.change(within(form).getByRole('combobox', { name: t.activityType }), { target: { value: 'practice' } });
    await waitFor(() => assert.equal(navigation.length, 2));
    url = new URL(navigation.at(-1).url, 'http://localhost');
    assert.equal(url.searchParams.get('activity'), 'practice');
    assert.equal(url.searchParams.get('result'), null, 'changing type clears an incompatible result');
    fireEvent.change(within(form).getByRole('searchbox'), { target: { value: 'Виенски' } });
    fireEvent.submit(form);
    await waitFor(() => assert.equal(navigation.length, 3));
    url = new URL(navigation.at(-1).url, 'http://localhost');
    assert.equal(url.searchParams.get('q'), 'Виенски');
    assert.deepEqual(navigation.at(-1).options, { scroll: false });
    assert.equal(within(form).getByRole('link', { name: t.clearFilters }).getAttribute('href'), '/coach/dashboard?view=activity');
});
