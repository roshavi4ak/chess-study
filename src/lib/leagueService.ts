import { prisma } from "@/lib/db";
import { weeklyEffort } from "@/lib/effortBoard";
import { getExcludedLichessIds } from "@/lib/leaderboardExclusions";
import { loadProgressHistory, type ProgressHistory } from "@/lib/progressHistory";
import { addDays, sofiaDay, weekDays } from "@/lib/reviewSchedule";
import { ACTIVE_WINDOW_DAYS, formGroups, nextTier, rankGroup, type LeagueTierName } from "@/lib/leagues";

export interface LeagueRow {
    id: string;
    name: string | null;
    image: string | null;
    points: number;
    rank: number;
    promotes: boolean;
}

export interface LeagueGroup {
    tier: LeagueTierName;
    index: number;
    rows: LeagueRow[];
}

// Effort points for a week, using only what happened up to that week's Sunday.
function pointsFor(userId: string, history: ProgressHistory, sunday: string) {
    const upTo = <T extends { createdAt: Date }>(items: T[]) => items.filter(item => sofiaDay(item.createdAt) <= sunday);
    return weeklyEffort({
        now: new Date(`${sunday}T12:00:00Z`),
        practiceAttempts: upTo(history.practiceAttempts.get(userId)!),
        puzzleAttempts: upTo(history.puzzleAttempts.get(userId)!),
        playSessions: upTo(history.playSessions.get(userId)!),
        practices: history.practices,
    }).effortPoints;
}

async function weekGroups(monday: string) {
    const sunday = addDays(monday, 6);
    const excluded = await getExcludedLichessIds();
    const [students, memberships] = await Promise.all([
        prisma.user.findMany({ where: { role: "STUDENT", lichessId: { notIn: excluded } }, select: { id: true, name: true, image: true } }),
        prisma.leagueMembership.findMany(),
    ]);
    const tiers = new Map(memberships.map(row => [row.userId, row.tier as LeagueTierName]));
    // Enough puzzle history for the activity window before the week.
    const since = new Date(`${addDays(monday, -ACTIVE_WINDOW_DAYS - 1)}T00:00:00Z`);
    const history = await loadProgressHistory(students.map(student => student.id), since);
    const windowStart = addDays(sunday, -ACTIVE_WINDOW_DAYS + 1);
    const active = students.filter(student => [
        ...history.practiceAttempts.get(student.id)!,
        ...history.puzzleAttempts.get(student.id)!,
        ...history.playSessions.get(student.id)!,
    ].some(item => {
        const day = sofiaDay(item.createdAt);
        return day >= windowStart && day <= sunday;
    }));
    const groups = formGroups(active.map(student => ({ ...student, tier: tiers.get(student.id) ?? "WOOD" as LeagueTierName })));
    return groups.map(group => ({
        tier: group.tier,
        index: group.index,
        rows: rankGroup(group.members.map(member => ({ id: member.id, name: member.name, image: member.image, points: pointsFor(member.id, history, sunday) })), group.tier),
    }));
}

// Applies last week's promotions once. Called lazily when leagues are viewed (no scheduled job needed).
export async function processLastWeek(now = new Date()) {
    const lastMonday = addDays(weekDays(sofiaDay(now))[0], -7);
    if (await prisma.leagueWeek.findUnique({ where: { weekStart: lastMonday } })) return;
    // Claim the week first; if another request already did, it will apply the promotions.
    try {
        await prisma.leagueWeek.create({ data: { weekStart: lastMonday } });
    } catch {
        return;
    }
    try {
        const groups = await weekGroups(lastMonday);
        const promoted = groups.flatMap(group => group.rows.filter(row => row.promotes).map(row => ({ id: row.id, tier: nextTier(group.tier) })));
        for (const { id, tier } of promoted) {
            await prisma.leagueMembership.upsert({ where: { userId: id }, update: { tier }, create: { userId: id, tier } });
        }
        await prisma.leagueWeek.update({ where: { weekStart: lastMonday }, data: { promoted: promoted.length } });
    } catch (error) {
        // Release the claim so the next visit tries again.
        await prisma.leagueWeek.delete({ where: { weekStart: lastMonday } }).catch(() => undefined);
        throw error;
    }
}

export async function currentLeagueGroups(now = new Date()): Promise<{ monday: string; sunday: string; groups: LeagueGroup[] }> {
    await processLastWeek(now);
    const monday = weekDays(sofiaDay(now))[0];
    return { monday, sunday: addDays(monday, 6), groups: await weekGroups(monday) };
}
