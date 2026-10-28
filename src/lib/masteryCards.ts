import { groupLineHistories, isSkillTag, type PracticeAttemptRecord, type PracticeInfo } from "./dailyMission";
import { isLineMastered, sofiaDay } from "./reviewSchedule";
import { BOTS, BOT_CARD_WINS } from "./bots";
import { WORLDS, miniKey, worldTier } from "./miniGames";
import { CARD_THEMES } from "./cardThemes";

export type CardTier = "bronze" | "silver" | "gold";
const TIERS: CardTier[] = ["bronze", "silver", "gold"];

// Share of a practice's lines that must be mastered (see isLineMastered).
export const PRACTICE_TIER_SHARES = [0.5, 0.8, 1];
// Different days on which the child solved at least one puzzle of the theme.
export const THEME_TIER_DAYS = [3, 5, 10];

export interface MasteryCard {
    id: string; // "practice:<id>", "theme:<tag>", "bot:<id>", "world:<id>", "activity:<id>", "tournament"
    kind: "practice" | "theme" | "bot" | "world" | "tournament" | "activity";
    practiceId: string | null;
    tag: string | null;
    name: string;
    tier: CardTier | null;
    current: number;
    // Count needed for the next tier, or null once gold is reached.
    nextTarget: number | null;
}

export function cardTier(current: number, targets: number[]) {
    const reached = targets.filter(target => current >= target).length;
    return { tier: reached ? TIERS[reached - 1] : null, nextTarget: targets[reached] ?? null };
}

export function practiceCards(practiceAttempts: PracticeAttemptRecord[], practices: Map<string, PracticeInfo>): MasteryCard[] {
    const mastered = new Map<string, number>();
    for (const [key, attempts] of groupLineHistories(practiceAttempts, practices)) {
        const practiceId = key.slice(0, key.indexOf(":"));
        if (isLineMastered(attempts)) {
            mastered.set(practiceId, (mastered.get(practiceId) ?? 0) + 1);
        }
    }
    return [...practices.keys()].map(practiceId => {
        const info = practices.get(practiceId)!;
        const current = mastered.get(practiceId) ?? 0;
        const targets = PRACTICE_TIER_SHARES.map(share => Math.max(1, Math.ceil(share * info.leafIds.length)));
        return { id: `practice:${practiceId}`, kind: "practice" as const, practiceId, tag: null, name: info.name, current, ...cardTier(current, targets) };
    });
}

export function themeCards(solvedPuzzles: { createdAt: Date; tags: string[] }[]): MasteryCard[] {
    const days = new Map<string, Set<string>>(CARD_THEMES.map(tag => [tag, new Set<string>()]));
    for (const puzzle of solvedPuzzles) {
        const day = sofiaDay(puzzle.createdAt);
        for (const tag of puzzle.tags) {
            if (!isSkillTag(tag)) continue;
            days.set(tag, (days.get(tag) ?? new Set()).add(day));
        }
    }
    return [...days].map(([tag, solvedDays]) => ({
        id: `theme:${tag}`, kind: "theme" as const, practiceId: null, tag, name: tag, current: solvedDays.size,
        ...cardTier(solvedDays.size, THEME_TIER_DAYS),
    }));
}

// One card per animal bot, earned by winning against it (1 / 3 / 5 wins). Locked animals still show.
export function botCards(wins: Record<string, number>): MasteryCard[] {
    return BOTS.map(bot => ({
        id: `bot:${bot.id}`, kind: "bot" as const, practiceId: null, tag: bot.id, name: bot.id, current: wins[bot.id] ?? 0,
        ...cardTier(wins[bot.id] ?? 0, BOT_CARD_WINS),
    }));
}

// One card per mini-game world: bronze when every level has a star, silver at 2 stars each, gold at 3.
// Progress counts all stars in the world against the next tier's total.
export function worldCards(bestScores: Record<string, number>): MasteryCard[] {
    return WORLDS.map(world => {
        const tier = worldTier(world, bestScores);
        const reached = tier ? TIERS.indexOf(tier) + 1 : 0;
        const current = world.levels.reduce((sum, level) => sum + Math.min(3, bestScores[miniKey(level.id)] ?? 0), 0);
        return {
            id: `world:${world.id}`, kind: "world" as const, practiceId: null, tag: world.id, name: world.id, tier, current,
            nextTarget: reached < 3 ? world.levels.length * (reached + 1) : null,
        };
    });
}

// Club tournaments played on Lichess: bronze for 1, silver for 5, gold for 15.
export const TOURNAMENT_CARD_COUNTS = [1, 5, 15];

export function tournamentCards(played: number): MasteryCard[] {
    return [{ id: "tournament", kind: "tournament", practiceId: null, tag: null, name: "tournament", current: played, ...cardTier(played, TOURNAMENT_CARD_COUNTS) }];
}

// Highest tier first, then the cards closest to their next tier.
export function sortCards(cards: MasteryCard[]): MasteryCard[] {
    const rank = (card: MasteryCard) => card.tier ? TIERS.indexOf(card.tier) + 1 : 0;
    const closeness = (card: MasteryCard) => card.nextTarget ? card.current / card.nextTarget : 1;
    return [...cards].sort((a, b) => rank(b) - rank(a) || closeness(b) - closeness(a) || a.name.localeCompare(b.name));
}

// Keys like "practice:abc:silver" for every tier a card has reached, used to spot newly earned tiers.
export function earnedKeys(cards: MasteryCard[]): string[] {
    return cards.flatMap(card => card.tier ? TIERS.slice(0, TIERS.indexOf(card.tier) + 1).map(tier => `${card.id}:${tier}`) : []);
}
