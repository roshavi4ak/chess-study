/* eslint-disable @typescript-eslint/no-require-imports -- Real PostgreSQL regression tests; only auth and Next cache boundaries are replaced. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test, before, beforeEach, after } = require('node:test');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

// Never fall back to .env or the application's configured database.
const databaseUrl = process.env.CHALLENGE_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set CHALLENGE_TEST_DATABASE_URL to an isolated local PostgreSQL database ending in _test.');
const target = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Challenge persistence tests require a local database ending in _test.');
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const prefix = `challenge-test-${randomUUID()}`;
const ids = Object.fromEntries(['coach', 'a', 'b', 'c', 'practice', 'root', 'leaf', 'puzzle'].map(key => [key, `${prefix}-${key}`]));
let session;
const boundaries = { '@/auth': { auth: async () => session }, '@/lib/db': { prisma }, 'next/cache': { revalidatePath() {} } };
const cache = new Map();
function loadSource(file) {
    const base = path.isAbsolute(file) ? file : path.resolve(__dirname, file);
    const filename = fs.existsSync(base) ? base : `${base}.ts`;
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); mod.filename = filename; cache.set(filename, mod); mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => Object.hasOwn(boundaries, name) ? boundaries[name] : name.startsWith('@/') ? loadSource(path.resolve(__dirname, '../src', name.slice(2))) : name.startsWith('./') ? loadSource(path.resolve(path.dirname(filename), name)) : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
}
const actions = loadSource('../src/app/actions/clubGoals.ts');
const { sofiaDay, addDays } = loadSource('../src/lib/reviewSchedule.ts');
const today = sofiaDay(new Date());
const date = day => new Date(`${day}T12:00:00Z`);
const definition = { startsOn: addDays(today, -7), endsOn: addDays(today, 7), metric: 'PUZZLES_SOLVED', tag: 'fork', practiceId: null };
const input = { ...definition, name: prefix, scoring: 'TOTAL', teams: [
    { name: 'BelOzem', color: 'blue', memberIds: [ids.a, ids.b] }, { name: 'Chirpan', color: 'red', memberIds: [ids.c] },
] };
let challengeId;
before(async () => {
    await prisma.user.createMany({ data: ['coach', 'a', 'b', 'c'].map(key => ({ id: ids[key], name: key === 'coach' ? 'Test Coach' : { a: 'Anna', b: 'Boris', c: 'Cleo' }[key], email: `${key}-${prefix}@example.invalid`, lichessId: `${prefix}-${key}`, role: key === 'coach' ? 'COACH' : 'STUDENT', isNameSet: true, ratingPuzzle: 1200 })) });
    await prisma.puzzle.create({ data: { id: ids.puzzle, name: prefix, fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', solution: 'g6g7', tags: ['fork'], createdBy: ids.coach } });
    await prisma.puzzleAttempt.createMany({ data: [[ids.a, true, 10], [ids.a, true, 12], [ids.b, false, 0], [ids.b, true, 4], [ids.c, true, 8]].map(([userId, success, challengePoints]) => ({ userId, success, challengePoints, puzzleId: ids.puzzle, createdAt: date(today) })) });
    await prisma.practice.create({ data: { id: ids.practice, name: 'Italian game', createdBy: ids.coach, nodes: { create: [{ id: ids.root, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }, { id: ids.leaf, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', move: 'e2e4', parentId: ids.root }] } } });
    await prisma.practiceAttempt.createMany({ data: [-6, -3, 0].map(offset => ({ userId: ids.a, practiceId: ids.practice, nodeId: ids.leaf, status: 'PERFECT', createdAt: date(addDays(today, offset)) })) });
});
beforeEach(() => { session = { user: { id: ids.coach, role: 'COACH' } }; });
after(async () => {
    if (process.env.CHALLENGE_KEEP_TEST_DATA !== '1') {
        await prisma.teamChallenge.deleteMany({ where: { createdBy: ids.coach } });
        await prisma.clubGoal.deleteMany({ where: { createdBy: ids.coach } });
        await prisma.clubTeam.deleteMany({ where: { createdBy: ids.coach } });
        await prisma.puzzle.deleteMany({ where: { id: ids.puzzle } });
        await prisma.practice.deleteMany({ where: { id: ids.practice } });
        await prisma.user.deleteMany({ where: { id: { in: ['coach', 'a', 'b', 'c'].map(key => ids[key]) } } });
    } else console.log(`Browser fixtures retained: coach email coach-${prefix}@example.invalid; student email a-${prefix}@example.invalid`);
    await prisma.$disconnect();
});

test('saved teams persist independently, and later edits/deletion leave a challenge snapshot untouched', async () => {
    await actions.saveClubTeam({ name: 'Reusable BelOzem', color: 'blue', memberIds: [ids.a, ids.b] });
    const saved = await prisma.clubTeam.findFirstOrThrow({ where: { createdBy: ids.coach }, include: { members: true } });
    assert.equal(saved.members.length, 2);
    await actions.createChallenge(input);
    challengeId = (await prisma.teamChallenge.findFirstOrThrow({ where: { createdBy: ids.coach } })).id;
    await actions.saveClubTeam({ name: 'Changed reusable roster', color: 'green', memberIds: [ids.c] }, saved.id);
    await actions.deleteClubTeam(saved.id);
    const challenge = await actions.getChallengeForEdit(challengeId);
    assert.deepEqual(challenge.teams.map(team => [team.name, [...team.memberIds].sort()]), input.teams.map(team => [team.name, [...team.memberIds].sort()]));
});

test('editing preserves team identity and bonus, recalculates actual activity, and leaves student records unchanged', async () => {
    const existing = await actions.getChallengeForEdit(challengeId);
    await actions.addTeamBonus(existing.teams[0].id, 7);
    const attempts = await prisma.puzzleAttempt.findMany({ where: { puzzleId: ids.puzzle }, orderBy: { id: 'asc' } });
    const edited = { ...existing, name: `${prefix} edited`, metric: 'PUZZLE_POINTS', scoring: 'AVERAGE', startsOn: today };
    await actions.updateChallenge(challengeId, edited);
    const stored = await prisma.teamChallenge.findUniqueOrThrow({ where: { id: challengeId }, include: { teams: { orderBy: { order: 'asc' } } } });
    assert.equal(stored.name, edited.name); assert.equal(stored.scoring, 'AVERAGE');
    assert.equal(stored.teams[0].id, existing.teams[0].id); assert.equal(stored.teams[0].bonus, 7);
    const view = (await actions.getClubChallenges()).challenges.find(item => item.id === challengeId);
    const team = view.teams.find(team => team.id === existing.teams[0].id);
    assert.equal(team.earned, 26); assert.equal(team.score, 20, '26 / 2 + 7');
    assert.deepEqual(team.members.map(member => member.value).sort((a, b) => a - b), [4, 22]);
    assert.deepEqual(await prisma.puzzleAttempt.findMany({ where: { puzzleId: ids.puzzle }, orderBy: { id: 'asc' } }), attempts);
    await actions.updateChallenge(challengeId, { ...edited, metric: 'LINES_MASTERED', practiceId: ids.practice, startsOn: addDays(today, -1), scoring: 'TOTAL' });
    const lines = (await actions.getClubChallenges()).challenges.find(item => item.id === challengeId);
    assert.equal(lines.practiceId, ids.practice); assert.equal(lines.tag, null);
    assert.equal(lines.teams.find(team => team.id === existing.teams[0].id).earned, 1);
});

test('duplicate membership, foreign team IDs and invalid periods cannot partially change a challenge', async () => {
    const existing = await actions.getChallengeForEdit(challengeId);
    for (const patch of [
        { teams: existing.teams.map(team => ({ ...team, memberIds: [ids.a] })) },
        { teams: existing.teams.map((team, index) => index === 0 ? { ...team, id: 'foreign-team-id' } : team) },
        { endsOn: addDays(existing.startsOn, -1) },
        { scoring: 'UNKNOWN' },
    ]) {
        await assert.rejects(actions.updateChallenge(challengeId, { ...existing, ...patch }));
        assert.deepEqual(await actions.getChallengeForEdit(challengeId), existing);
    }
});

test('editing can add/remove teams and move members while retaining the other teams bonus', async () => {
    const existing = await actions.getChallengeForEdit(challengeId);
    const removedId = existing.teams[1].id;
    const teams = [{ ...existing.teams[0], memberIds: [ids.a] }, { name: 'New green team', color: 'green', memberIds: [ids.b, ids.c] }];
    await actions.updateChallenge(challengeId, { ...existing, teams });
    const result = await actions.getChallengeForEdit(challengeId);
    assert.equal(result.teams.length, 2); assert.equal(result.teams[0].id, existing.teams[0].id);
    assert.equal(await prisma.challengeTeam.findUnique({ where: { id: removedId } }), null);
    assert.deepEqual([...result.teams[1].memberIds].sort(), [ids.b, ids.c].sort());
    assert.equal((await prisma.challengeTeam.findUniqueOrThrow({ where: { id: result.teams[0].id } })).bonus, 7);
});

test('club goal editing preserves manual progress and applies the new target and measure', async () => {
    await actions.createClubGoal({ ...definition, title: prefix, target: 500 });
    const goal = await prisma.clubGoal.findFirstOrThrow({ where: { createdBy: ids.coach } });
    await actions.addClubGoalBonus(goal.id, 3);
    await actions.updateClubGoal(goal.id, { ...definition, title: 'Notation together', metric: 'NOTATION_CORRECT', target: 200 });
    const updated = await prisma.clubGoal.findUniqueOrThrow({ where: { id: goal.id } });
    assert.equal(updated.bonus, 3); assert.equal(updated.target, 200); assert.equal(updated.title, 'Notation together'); assert.equal(updated.tag, null);
});

test('students receive their own contribution while individual peer values stay private', async () => {
    session = { user: { id: ids.a, role: 'STUDENT' } };
    const view = (await actions.getClubChallenges()).challenges.find(item => item.id === challengeId);
    assert.equal(view.myValue, 1); assert(view.myTeamId);
    assert(view.teams.flatMap(team => team.members).every(member => member.value === null));
});

test('student and anonymous sessions cannot use any management action or edit loader', async () => {
    const countBefore = await prisma.teamChallenge.count();
    for (const user of [null, { user: { id: ids.a, role: 'STUDENT' } }]) {
        session = user;
        for (const action of [
            () => actions.saveClubTeam({ name: 'No', color: 'red', memberIds: [ids.a] }),
            () => actions.deleteClubTeam('unknown'), () => actions.createChallenge(input),
            () => actions.updateChallenge(challengeId, input), () => actions.deleteChallenge(challengeId),
            () => actions.getChallengeForEdit(challengeId), () => actions.getTeamPlanningOptions(),
            () => actions.moveChallengeMember(challengeId, ids.a, null), () => actions.addTeamBonus('unknown', 5),
            () => actions.createClubGoal({ ...definition, title: 'No', target: 1 }),
            () => actions.updateClubGoal('unknown', { ...definition, title: 'No', target: 1 }),
            () => actions.deleteClubGoal('unknown'), () => actions.addClubGoalBonus('unknown', 5), () => actions.getClubGoalForEdit('unknown'),
        ]) await assert.rejects(action(), /Unauthorized/);
    }
    assert.equal(await prisma.teamChallenge.count(), countBefore);
});
