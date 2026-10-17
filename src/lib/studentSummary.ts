import { buildDailyMission, groupLineHistories, type PlaySessionRecord, type PracticeAttemptRecord, type PracticeInfo, type PuzzleAttemptRecord } from "./dailyMission";
import { addDays, isLineMastered, sofiaDay, weekDays } from "./reviewSchedule";

export const BACKLOG_ALERT = 10;
export const INACTIVE_ALERT_DAYS = 5;

export interface StudentSummary {
    backlog: number;
    weakTheme: string | null;
    activeDaysThisWeek: number;
    lastActiveDay: string | null;
    mastered: number;
    masteredThisWeek: number;
    flags: ("backlog" | "inactive")[];
}

export function summarizeStudent({ now, practiceAttempts, puzzleAttempts, practices, playSessions = [] }: {
    now: Date;
    practiceAttempts: PracticeAttemptRecord[];
    puzzleAttempts: PuzzleAttemptRecord[];
    practices: Map<string, PracticeInfo>;
    playSessions?: PlaySessionRecord[];
}): StudentSummary {
    const today = sofiaDay(now);
    const monday = weekDays(today)[0];
    const mission = buildDailyMission({ now, practiceAttempts, puzzleAttempts, practices, playSessions });

    let mastered = 0;
    let masteredThisWeek = 0;
    for (const attempts of groupLineHistories(practiceAttempts, practices).values()) {
        if (!isLineMastered(attempts)) continue;
        mastered += 1;
        if (!isLineMastered(attempts.filter(attempt => sofiaDay(attempt.createdAt) < monday))) masteredThisWeek += 1;
    }

    const activeDays = [...practiceAttempts, ...puzzleAttempts, ...playSessions].map(item => item.createdAt)
        .map(sofiaDay)
        .sort();
    const lastActiveDay = activeDays[activeDays.length - 1] ?? null;

    const flags: StudentSummary["flags"] = [];
    if (mission.dueCount >= BACKLOG_ALERT) flags.push("backlog");
    if (!lastActiveDay || lastActiveDay <= addDays(today, -INACTIVE_ALERT_DAYS)) flags.push("inactive");

    return {
        backlog: mission.dueCount,
        weakTheme: mission.puzzles.tag,
        activeDaysThisWeek: mission.week.activeCount,
        lastActiveDay,
        mastered,
        masteredThisWeek,
        flags,
    };
}
