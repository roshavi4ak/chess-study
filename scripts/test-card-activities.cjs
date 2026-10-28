/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the actual card rules without a database. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
    const filename = path.resolve(__dirname, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => name.startsWith('./') && !name.endsWith('.json')
        ? load(path.relative(__dirname, path.resolve(path.dirname(filename), `${name}.ts`))) : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
}
const { activityCards } = load('../src/lib/activityCards.ts');
const { CARD_ACTIVITIES } = load('../src/lib/cardActivities.ts');
const { getCardActivityHref } = load('../src/lib/cardActivity.ts');
const { practiceCards, themeCards } = load('../src/lib/masteryCards.ts');
const { getCardArtwork } = load('../src/lib/cardArtwork.ts');
const row = (kind, key, day = '01', score = 1, won = true) => ({ kind, key, score, won, createdAt: new Date(`2026-10-${day}T12:00:00+03:00`) });
const find = (cards, id) => cards.find(card => card.tag === id);

test('every activity is discoverable before playing and has a start destination and its own artwork', () => {
    const cards = activityCards([], []);
    assert.equal(cards.length, 12);
    assert(cards.every(card => card.tier === null && card.current === 0));
    assert.equal(new Set(cards.map(getCardArtwork)).size, cards.length);
    for (const card of cards) {
        assert.equal(getCardActivityHref(card), CARD_ACTIVITIES.find(a => a.id === card.tag).href);
        assert(getCardArtwork(card).endsWith(`activity-${card.tag}.webp`));
    }
});

test('completed days progress through bronze, silver and gold; same-day replays never add days', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => row('STREAK', '', String(i + 1).padStart(2, '0')));
    for (const [count, tier, next] of [[2, null, 3], [3, 'bronze', 5], [5, 'silver', 10], [10, 'gold', null]]) {
        const card = find(activityCards([...sessions.slice(0, count), sessions[0], sessions[0]], []), 'streak');
        assert.deepEqual([card.current, card.tier, card.nextTarget], [count, tier, next]);
    }
});

test('day boundaries use Sofia dates rather than UTC dates', () => {
    const sessions = [row('COORDINATES', 'white', '02'), { ...row('COORDINATES', 'black'), createdAt: new Date('2026-10-01T21:30:00Z') }];
    assert.equal(find(activityCards(sessions, []), 'coordinates').current, 1);
});

test('training keys and successful outcomes keep unrelated or failed sessions out of cards', () => {
    const sessions = [row('MINIGAME', 'endgame:rookMate'), row('MINIGAME', 'endgame:queenMate', '02', 0, false), row('MINIGAME', 'mini:rook-1', '03', 3), row('MINIGAME', 'defense:level:1'), row('MINIGAME', 'defense:level:10', '02'), row('MINIGAME', 'freeplay:abc123'), row('BOT_GAME', 'bot:sloth', '03')];
    const cards = activityCards(sessions, []);
    assert.equal(find(cards, 'endgames').current, 1);
    assert.equal(find(cards, 'defense').current, 2);
    assert.equal(find(cards, 'freeplay').current, 1);
});

test('solo completions with help count, failed level tests do not, and race participation need not win', () => {
    const cards = activityCards([row('SOLO_CHESS', 'solo:one', '01', 0, true), row('LEVEL_TEST', 'level:pawn-1', '01', 2, false), row('LEVEL_TEST', 'level:pawn-1', '02', 6, true), row('LEVEL_PRACTICE', 'level:pawn-1', '03', 1, null), row('RACE', 'race:one', '01', 0, false), row('DUEL', 'duel:one', '01', 0, false), row('NOTATION', 'write', '01', 0), row('NOTATION', 'read', '02', 1)], []);
    assert.equal(find(cards, 'solo').current, 1);
    assert.equal(find(cards, 'levels').current, 2);
    assert.equal(find(cards, 'race').current, 1);
    assert.equal(find(cards, 'duel').current, 1);
    assert.equal(find(cards, 'notation').current, 1);
});

test('puzzle card uses only successful days and teamwork uses distinct contributions', () => {
    const puzzles = [{ success: true, createdAt: row('', '').createdAt }, { success: true, createdAt: row('', '').createdAt }, { success: false, createdAt: row('', '', '02').createdAt }];
    assert.equal(find(activityCards([], puzzles), 'puzzles').current, 1);
    for (const [count, tier] of [[0, null], [1, 'bronze'], [3, 'silver'], [5, 'gold']]) assert.equal(find(activityCards([], [], count), 'teamwork').tier, tier);
});

test('unstarted practices and all supported themes remain visible without inventing earned progress', () => {
    const cards = practiceCards([], new Map([['new', { name: 'New practice', leafIds: ['a', 'b', 'c'] }]]));
    assert.deepEqual([cards[0].tier, cards[0].current, cards[0].nextTarget], [null, 0, 2]);
    const themes = themeCards([]);
    assert.equal(themes.length, 50);
    assert(themes.every(card => card.tier === null && card.current === 0));
});

test('start links select the exact practice, theme, opponent and world safely', () => {
    assert.equal(getCardActivityHref({ kind: 'practice', practiceId: 'new practice' }), '/practices/new%20practice');
    assert.equal(getCardActivityHref({ kind: 'theme', tag: 'fork&pin' }), '/puzzles/play?tag=fork%26pin');
    assert.equal(getCardActivityHref({ kind: 'bot', tag: 'fox' }), '/play/bots?bot=fox');
    assert.equal(getCardActivityHref({ kind: 'world', tag: 'knight' }), '/games/knight');
    assert.equal(getCardActivityHref({ kind: 'tournament' }), '/tournaments');
});

test('all 29 catalog practices have distinct illustrations and both delivery sizes exist for every card', () => {
    const catalog = require('../docs/card-practice-catalog.json');
    const practices = practiceCards([], new Map(catalog.map(practice => [practice.id, { name: practice.name, leafIds: ['one'] }])));
    assert.equal(practices.length, 29);
    const art = practices.map(getCardArtwork);
    assert.equal(new Set(art).size, 29, 'each current opening needs distinct artwork');
    assert(!art.some(file => /opening-(gambit|guardian|explorer)\.webp$/.test(file)), 'known openings must not use generic fallback art');
    for (const card of [...practices, ...themeCards([]), ...activityCards([], [])]) {
        const file = getCardArtwork(card);
        for (const relative of [file, file.replace('/img/cards/', '/img/cards/full/')]) assert(fs.existsSync(path.resolve(__dirname, '../public', `.${relative}`)), relative);
    }
});

function cardAction(session, queryLog) {
    const catalog = require('../docs/card-practice-catalog.json');
    const goal = metric => ({ metric, tag: null, practiceId: null, startsOn: new Date('2026-10-01Z'), endsOn: new Date('2026-10-31Z') });
    const overrides = {
        '@/auth': { auth: async () => session },
        '@/lib/db': { prisma: {
            puzzleAttempt: { findMany: async args => {
                queryLog.push(args.where.userId);
                return ['01', '02', '03'].map(day => ({ success: true, createdAt: row('', '', day).createdAt, challengePoints: 1, puzzle: { tags: ['fork'] } }));
            } },
            practice: { findMany: async () => catalog.map(practice => ({ ...practice, nodes: [{ id: `${practice.id}-root`, parentId: null }, { id: `${practice.id}-leaf`, parentId: `${practice.id}-root` }] })) },
            teamChallenge: { findMany: async args => { queryLog.push(args.where.members.some.userId); return [goal('PUZZLES_SOLVED')]; } },
            clubGoal: { findMany: async () => [goal('MANUAL')] },
        } },
        '@/lib/progressHistory': { loadProgressHistory: async ids => {
            queryLog.push(...ids);
            return { practiceAttempts: new Map([['student', []]]), playSessions: new Map([['student', []]]), practices: new Map() };
        } },
        '@/app/actions/play': { getBotWins: async () => ({}), getPersonalBests: async () => ({ byKey: {} }) },
        '@/app/actions/tournaments': { countMyTournaments: async () => 0 },
    };
    const filename = path.resolve(__dirname, '../src/app/actions/cards.ts');
    const mod = new Module(filename, module);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : name.startsWith('@/') ? load(`../src/${name.slice(2)}.ts`) : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return mod.exports.getMyCards;
}

test('collection action returns the full catalog using only the signed-in child’s progress', async () => {
    const log = [];
    const cards = await cardAction({ user: { id: 'student', role: 'STUDENT' } }, log)();
    assert.equal(Object.values(cards).flat().length, 108);
    assert.equal(cards.practices.length, 29);
    assert.equal(cards.themes.length, 50);
    assert.equal(cards.activities.length, 12);
    assert(log.every(userId => userId === 'student'));
    assert.equal(find(cards.activities, 'puzzles').tier, 'bronze');
    assert.equal(find(cards.activities, 'teamwork').current, 1, 'real contribution counts; a manual goal gives no automatic credit');
});

test('collection action does not query progress for signed-out visitors', async () => {
    const log = [];
    assert.equal(await cardAction(null, log)(), null);
    assert.deepEqual(log, []);
});
