"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { WEEKLY_GOAL_DAYS } from "@/lib/dailyMission";
import { weeklyEffort, type WeeklyEffort } from "@/lib/effortBoard";
import { getExcludedLichessIds } from "@/lib/leaderboardExclusions";
import { loadProgressHistory } from "@/lib/progressHistory";
import { sofiaDay, weekDays } from "@/lib/reviewSchedule";

export interface EffortRow extends WeeklyEffort {
    id: string;
    name: string | null;
    image: string | null;
}

export interface EffortBoardData {
    rows: EffortRow[];
    goal: number;
    dateRange: { start: string; end: string };
}

const label = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

export async function getEffortBoard(): Promise<EffortBoardData> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const now = new Date();
    const days = weekDays(sofiaDay(now));
    const students = await prisma.user.findMany({
        where: { role: "STUDENT", lichessId: { notIn: await getExcludedLichessIds() } },
        select: { id: true, name: true, image: true },
    });
    // Eight days back covers the whole Sofia week whatever the server's timezone.
    const history = await loadProgressHistory(students.map(student => student.id), new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000));

    const rows = students
        .map(student => ({
            ...student,
            ...weeklyEffort({
                now,
                practiceAttempts: history.practiceAttempts.get(student.id)!,
                puzzleAttempts: history.puzzleAttempts.get(student.id)!,
                practices: history.practices,
                playSessions: history.playSessions.get(student.id)!,
            }),
        }))
        // Children who did nothing this week are simply not listed, rather than shown at the bottom.
        .filter(row => row.effortPoints > 0)
        .sort((a, b) => b.effortPoints - a.effortPoints || b.activeDays - a.activeDays || (a.name ?? "").localeCompare(b.name ?? ""));

    return { rows, goal: WEEKLY_GOAL_DAYS, dateRange: { start: label(days[0]), end: label(days[6]) } };
}
