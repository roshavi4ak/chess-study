import { prisma } from "@/lib/db";

// The only account that may edit the list on /leaderboard/settings.
export const LEADERBOARD_ADMIN_LICHESS_ID = "roshavi4ak";

// The list from before it became editable. It fills an empty table automatically, and is used as-is
// while the LeaderboardExclusion table does not exist yet (before `prisma db push`).
const ORIGINAL_EXCLUSIONS = ["mi666ka", "belozem", "petar1976"];

export function isLeaderboardAdmin(lichessId: string | null | undefined) {
    return lichessId?.toLowerCase() === LEADERBOARD_ADMIN_LICHESS_ID;
}

// Makes sure the original list is in the table. Rows are never deleted (only un-hidden), so this runs once.
export async function ensureExclusionsInitialized() {
    if (await prisma.leaderboardExclusion.count() > 0) return;
    await prisma.leaderboardExclusion.createMany({
        data: ORIGINAL_EXCLUSIONS.map(lichessId => ({ lichessId, addedBy: "initial list" })),
        skipDuplicates: true,
    });
}

// Student accounts left out of every leaderboard (by Lichess id).
export async function getExcludedLichessIds(): Promise<string[]> {
    try {
        await ensureExclusionsInitialized();
        const rows = await prisma.leaderboardExclusion.findMany({ where: { hidden: true }, select: { lichessId: true } });
        return rows.map(row => row.lichessId);
    } catch (error) {
        console.error("[Leaderboard] Could not read hidden accounts, using the original list:", error);
        return ORIGINAL_EXCLUSIONS;
    }
}
