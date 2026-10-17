"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { currentLeagueGroups, type LeagueGroup } from "@/lib/leagueService";
import type { LeagueTierName } from "@/lib/leagues";

export interface LeagueView {
    monday: string;
    sunday: string;
    myTier: LeagueTierName;
    myGroup: LeagueGroup | null; // null when the child has not been active recently
    // Every group, for coaches only.
    allGroups: LeagueGroup[] | null;
}

export async function getLeagueView(): Promise<LeagueView | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    try {
        const { monday, sunday, groups } = await currentLeagueGroups();
        const membership = await prisma.leagueMembership.findUnique({ where: { userId: session.user.id } });
        return {
            monday,
            sunday,
            myTier: (membership?.tier ?? "WOOD") as LeagueTierName,
            myGroup: groups.find(group => group.rows.some(row => row.id === session.user!.id)) ?? null,
            allGroups: session.user.role === "COACH" ? groups : null,
        };
    } catch (error) {
        // Usually the league tables do not exist yet.
        console.error("[Leagues] Could not load leagues:", error);
        return null;
    }
}
