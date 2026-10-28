/* eslint-disable @typescript-eslint/no-require-imports -- Exercise real forms and cards with persistence/navigation boundaries mocked. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/bg/challenges' });
for (const key of ['window', 'self', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'FormData']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup, within } = require('@testing-library/react');
const { NextIntlClientProvider } = require('next-intl');
let calls, pushes, failure;
const actionNames = ['createChallenge', 'updateChallenge', 'createClubGoal', 'updateClubGoal', 'saveClubTeam', 'deleteClubTeam', 'deleteChallenge', 'deleteClubGoal', 'addTeamBonus', 'addClubGoalBonus', 'moveChallengeMember'];
const boundaries = {
    'next/navigation': { useRouter: () => ({ refresh() {}, push(href) { pushes.push(href); } }) },
    '@/i18n/navigation': { Link: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
    '@/app/actions/clubGoals': Object.fromEntries(actionNames.map(name => [name, async (...args) => { calls.push([name, ...args]); if (failure) throw new Error(failure); }])),
};
const cache = new Map();
function loadSource(file) {
    const base = path.isAbsolute(file) ? file : path.resolve(__dirname, file);
    const filename = fs.existsSync(base) ? base : ['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate));
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); mod.filename = filename; cache.set(filename, mod); mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => Object.hasOwn(boundaries, name) ? boundaries[name] : name.startsWith('@/') ? loadSource(path.resolve(__dirname, '../src', name.slice(2))) : name.startsWith('./') ? loadSource(path.resolve(path.dirname(filename), name)) : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
}
const ChallengeForm = loadSource('../src/components/ChallengeForm.tsx').default;
const ClubGoalForm = loadSource('../src/components/ClubGoalForm.tsx').default;
const ClubTeamLibrary = loadSource('../src/components/ClubTeamLibrary.tsx').default;
const { ChallengeCard, ClubGoalCard } = loadSource('../src/components/ChallengeBoard.tsx');
const messages = Object.fromEntries(['en', 'bg'].map(locale => [locale, require(`../messages/${locale}.json`)]));
const students = [{ id: 'a', name: 'Anna', ratingPuzzle: 1500 }, { id: 'b', name: 'Boris', ratingPuzzle: 1200 }, { id: 'c', name: 'Cleo', ratingPuzzle: 1100 }];
const savedTeams = [{ id: 'saved-a', name: 'BelOzem', color: 'blue', memberIds: ['a', 'b'] }, { id: 'saved-b', name: 'Chirpan', color: 'red', memberIds: ['c'] }];
const options = { students, practices: [{ id: 'italian', name: 'Italian game' }], tags: ['fork'], today: '2026-10-22', savedTeams };
const period = { metric: 'PUZZLES_SOLVED', tag: 'fork', practiceId: null, practiceName: null, startsOn: '2026-10-19', endsOn: '2026-10-25', phase: 'active', daysLeft: 4 };
const challenge = { ...period, id: 'cup', name: 'October cup', scoring: 'TOTAL', myTeamId: 'red', myValue: 12, teams: [
    { id: 'red', name: 'Red', color: 'red', bonus: 5, earned: 20, score: 25, rank: 1, memberIds: ['a', 'b'], members: [{ id: 'a', name: 'Anna', value: 12 }, { id: 'b', name: 'Boris', value: 8 }] },
    { id: 'blue', name: 'Blue', color: 'blue', bonus: 0, earned: 0, score: 0, rank: 2, memberIds: ['c'], members: [{ id: 'c', name: 'Cleo', value: 0 }] },
] };
const editData = { ...period, id: challenge.id, name: challenge.name, scoring: challenge.scoring, teams: challenge.teams.map(({ id, name, color, memberIds }) => ({ id, name, color, memberIds })) };
const goal = { ...period, id: 'goal', title: '500 puzzles', target: 500, bonus: 3, total: 20, percent: 4, reached: false, myValue: 12 };
function show(component, locale = 'en') { return render(React.createElement(NextIntlClientProvider, { locale, messages: messages[locale], timeZone: 'Europe/Sofia' }, component)); }
const change = (element, value) => fireEvent.change(element, { target: { value } });
beforeEach(() => { calls = []; pushes = []; failure = null; });
afterEach(cleanup);

for (const locale of ['en', 'bg']) {
    const t = messages[locale].Teams;
    test(`${locale}: selecting two saved rosters creates a challenge with every selected member`, async () => {
        show(React.createElement(ChallengeForm, options), locale);
        change(screen.getByLabelText(t.challengeName), 'November cup');
        change(screen.getByLabelText(t.selectSavedTeam.replace('{number}', '1')), 'saved-a');
        change(screen.getByLabelText(t.selectSavedTeam.replace('{number}', '2')), 'saved-b');
        assert.equal(screen.getByLabelText(t.selectSavedTeam.replace('{number}', '1')).value, 'saved-a');
        assert.equal(screen.getByLabelText(t.selectSavedTeam.replace('{number}', '2')).value, 'saved-b');
        assert.equal(screen.getByLabelText(t.teamFor.replace('{name}', 'Anna')).value, '0');
        assert.equal(screen.getByLabelText(t.teamFor.replace('{name}', 'Cleo')).value, '1');
        fireEvent.click(screen.getByRole('button', { name: t.createChallenge }));
        await waitFor(() => assert.equal(calls.length, 1));
        assert.equal(calls[0][0], 'createChallenge');
        assert.deepEqual(calls[0][1].teams, savedTeams.map(({ name, color, memberIds }) => ({ name, color, memberIds })));
    });
    test(`${locale}: edit is prefilled and saves changed name, rules, dates and rosters with retained IDs`, async () => {
        show(React.createElement(ChallengeForm, { ...options, initialData: editData }), locale);
        assert.equal(screen.getByLabelText(t.challengeName).value, 'October cup');
        change(screen.getByLabelText(t.challengeName), 'November final');
        change(screen.getByLabelText(t.measure), 'LINES_PLAYED');
        change(screen.getByLabelText(t.opening), 'italian');
        change(screen.getByLabelText(t.from), '2026-11-01');
        change(screen.getByLabelText(t.to), '2026-11-30');
        fireEvent.click(screen.getByRole('radio', { name: t.scoring_AVERAGE }));
        change(screen.getByLabelText(t.teamFor.replace('{name}', 'Anna')), '1');
        fireEvent.click(screen.getByRole('button', { name: t.saveChanges }));
        await waitFor(() => assert.equal(pushes.length, 1));
        const [action, id, input] = calls[0];
        assert.equal(action, 'updateChallenge'); assert.equal(id, 'cup');
        assert.equal(input.name, 'November final'); assert.equal(input.metric, 'LINES_PLAYED');
        assert.equal(input.practiceId, 'italian'); assert.equal(input.scoring, 'AVERAGE');
        assert.equal(input.startsOn, '2026-11-01'); assert.equal(input.endsOn, '2026-11-30');
        assert.deepEqual(input.teams.map(team => [team.id, team.memberIds]), [['red', ['b']], ['blue', ['a', 'c']]]);
        assert.equal(pushes[0], `/${locale}/coach/teams`);
    });
    test(`${locale}: club goals can change their title and target as well as the measure`, async () => {
        show(React.createElement(ClubGoalForm, { ...options, initialData: goal }), locale);
        change(screen.getByLabelText(t.goalTitle), '100 games'); change(screen.getByLabelText(t.target), '100');
        change(screen.getByLabelText(t.measure), 'FUN_GAMES');
        fireEvent.click(screen.getByRole('button', { name: t.saveChanges }));
        await waitFor(() => assert.equal(calls.length, 1));
        assert.equal(calls[0][0], 'updateClubGoal'); assert.equal(calls[0][1], 'goal');
        assert.equal(calls[0][2].title, '100 games'); assert.equal(calls[0][2].target, 100); assert.equal(calls[0][2].metric, 'FUN_GAMES');
    });
    test(`${locale}: a team is created independently and editing it saves only its own roster`, async () => {
        show(React.createElement(ClubTeamLibrary, { teams: savedTeams, students }), locale);
        change(screen.getByLabelText(t.teamName), 'Club juniors');
        fireEvent.click(screen.getByRole('checkbox', { name: 'Anna' }));
        fireEvent.click(screen.getByRole('button', { name: t.createTeam }));
        await waitFor(() => assert.equal(calls.length, 1));
        assert.deepEqual(calls[0], ['saveClubTeam', { name: 'Club juniors', color: 'red', memberIds: ['a'] }, undefined]);
        await waitFor(() => assert(screen.getByRole('status')));
        await waitFor(() => assert.equal(screen.getAllByRole('button', { name: t.edit })[0].disabled, false));
        fireEvent.click(screen.getAllByRole('button', { name: t.edit })[0]);
        assert.equal(screen.getByLabelText(t.teamName).value, 'BelOzem');
        fireEvent.click(screen.getByRole('checkbox', { name: 'Boris' }));
        fireEvent.click(screen.getByRole('button', { name: t.saveChanges }));
        await waitFor(() => assert.equal(calls.length, 2));
        assert.deepEqual(calls[1], ['saveClubTeam', { name: 'BelOzem', color: 'blue', memberIds: ['a'] }, 'saved-a']);
    });
    test(`${locale}: coach sees each member's value and edit links; students get their own share and direct start`, () => {
        show(React.createElement(ChallengeCard, { challenge, isCoach: true }), locale);
        assert(screen.getByRole('link', { name: t.edit }).getAttribute('href').endsWith('/cup/edit'));
        const contributions = screen.getByRole('list', { name: t.contributionsFor.replace('{team}', 'Red') });
        assert(within(contributions).getByText('12')); assert(within(contributions).getByText('8'));
        cleanup();
        const student = { ...challenge, teams: challenge.teams.map(team => ({ ...team, members: team.members.map(member => ({ ...member, value: null })) })) };
        show(React.createElement(ChallengeCard, { challenge: student, isCoach: false }), locale);
        assert.equal(screen.getByRole('link', { name: t.startContributing }).getAttribute('href'), '/puzzles/play?tag=fork');
        assert.equal(screen.queryByRole('link', { name: t.edit }), null);
        assert.equal(screen.queryByText(t.memberContributions), null);
        assert(screen.getByText(t.yourShare.replace('{value}', '12'), { exact: false }));
    });
}

test('a saved team with overlapping members is rejected without silently moving children', () => {
    show(React.createElement(ChallengeForm, { ...options, savedTeams: [...savedTeams, { id: 'overlap', name: 'Overlap', color: 'green', memberIds: ['b', 'c'] }] }));
    change(screen.getByLabelText('Use a saved team for team 1'), 'saved-a');
    change(screen.getByLabelText('Use a saved team for team 2'), 'overlap');
    assert.match(screen.getByRole('alert').textContent, /Boris/);
    assert.equal(screen.getByLabelText('Team for Boris').value, '0');
    assert.equal(screen.getByLabelText('Team for Cleo').value, '');
});

test('failed saves keep edits and show the error without navigating away', async () => {
    failure = 'Unable to save';
    show(React.createElement(ChallengeForm, { ...options, initialData: editData }));
    change(screen.getByLabelText('Name'), 'Keep this name');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => assert.equal(screen.getByRole('alert').textContent, failure));
    assert.equal(screen.getByLabelText('Name').value, 'Keep this name'); assert.equal(pushes.length, 0);
});

test('practice buttons respect the opening, scoring dates, membership and manual activities', () => {
    show(React.createElement(ChallengeCard, { challenge: { ...challenge, metric: 'LINES_MASTERED', tag: null, practiceId: 'italian', phase: 'upcoming' }, isCoach: false }));
    assert.equal(screen.getByRole('link', { name: 'Learn / practise' }).getAttribute('href'), '/practices/italian');
    assert(screen.getByText(messages.en.Teams.practiceBeforeStart)); cleanup();
    show(React.createElement(ChallengeCard, { challenge: { ...challenge, myTeamId: null, myValue: null }, isCoach: false }));
    assert.equal(screen.queryByRole('link', { name: 'Start contributing' }), null);
    assert(screen.getByText(messages.en.Teams.practiceWithoutTeam)); cleanup();
    show(React.createElement(ChallengeCard, { challenge: { ...challenge, phase: 'finished' }, isCoach: false }));
    assert.equal(screen.queryByRole('link', { name: 'Start contributing' }), null); cleanup();
    show(React.createElement(ChallengeCard, { challenge: { ...challenge, metric: 'MANUAL' }, isCoach: false }));
    assert(screen.getByText(messages.en.Teams.manualActivity)); assert.equal(screen.queryByRole('link', { name: 'Start contributing' }), null); cleanup();
    show(React.createElement(ClubGoalCard, { goal, isCoach: false }));
    assert.equal(screen.getByRole('link', { name: 'Start contributing' }).getAttribute('href'), '/puzzles/play?tag=fork');
});
