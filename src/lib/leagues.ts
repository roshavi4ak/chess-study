// Weekly leagues (inspired by Chess.com's Players League): children of the same tier are grouped,
// scored by the week's effort points, and the top PROMOTE of each group move up. Nobody moves down.

export const LEAGUE_TIERS = ["WOOD", "STONE", "BRONZE", "SILVER", "GOLD", "DIAMOND"] as const;
export type LeagueTierName = (typeof LEAGUE_TIERS)[number];

export const GROUP_SIZE = 10;
export const PROMOTE = 3;
// Children are placed in a league when they were active in this many recent days.
export const ACTIVE_WINDOW_DAYS = 14;

export const nextTier = (tier: LeagueTierName): LeagueTierName =>
    LEAGUE_TIERS[Math.min(LEAGUE_TIERS.indexOf(tier) + 1, LEAGUE_TIERS.length - 1)];

export interface LeagueMember {
    id: string;
    tier: LeagueTierName;
}

// Groups for one week: per tier, members in a stable order (by id) split into groups of at most GROUP_SIZE,
// as evenly as possible. Same input always gives the same groups.
export function formGroups<T extends LeagueMember>(members: T[]): { tier: LeagueTierName; index: number; members: T[] }[] {
    const groups: { tier: LeagueTierName; index: number; members: T[] }[] = [];
    for (const tier of LEAGUE_TIERS) {
        const inTier = members.filter(member => member.tier === tier).sort((a, b) => a.id.localeCompare(b.id));
        if (!inTier.length) continue;
        const count = Math.ceil(inTier.length / GROUP_SIZE);
        const size = Math.ceil(inTier.length / count);
        for (let index = 0; index < count; index++) {
            groups.push({ tier, index, members: inTier.slice(index * size, (index + 1) * size) });
        }
    }
    return groups;
}

// Ranked group with who moves up: the top PROMOTE with at least one point (Diamond is the top tier).
export function rankGroup<T extends { id: string; points: number; name: string | null }>(members: T[], tier: LeagueTierName) {
    const ranked = [...members].sort((a, b) => b.points - a.points || (a.name ?? "").localeCompare(b.name ?? "") || a.id.localeCompare(b.id));
    const canPromote = tier !== LEAGUE_TIERS[LEAGUE_TIERS.length - 1];
    return ranked.map((member, index) => ({ ...member, rank: index + 1, promotes: canPromote && index < PROMOTE && member.points > 0 }));
}
