const TIME_ZONE = "Europe/Sofia";

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

// Calendar days are "YYYY-MM-DD" strings in Sofia time, so they compare and sort as text.
export function sofiaDay(date: Date): string {
    const parts = dayFormatter.formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addDays(day: string, days: number): string {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function weekDays(day: string): string[] {
    const daysSinceMonday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
    const monday = addDays(day, -daysSinceMonday);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

// Days until the next review, indexed by level. Level 0 lines come back the next day.
export const REVIEW_INTERVALS = [1, 2, 4, 8, 16, 32];

// A perfect run adds a step and a run with mistakes takes one away, so three perfect runs in a row master a line.
export const MASTERY_STEPS = 3;
// Once a line has been played more than this many times, it also has to stay mostly perfect...
export const MASTERY_CHECK_AFTER_RUNS = 5;
// ...judged on the latest runs only, so a rough start does not block a line forever.
export const MASTERY_RECENT_RUNS = 10;
export const MASTERY_PERFECT_SHARE = 0.8;

export type AttemptStatus = "PERFECT" | "COMPLETED" | "PARTIAL" | "NEVER_SEEN";

export interface LineAttempt {
    status: AttemptStatus;
    createdAt: Date;
}

export interface LineReviewState {
    level: number;
    lastDay: string;
    dueDay: string;
}

export function getLineReviewState(attempts: LineAttempt[]): LineReviewState | null {
    let level = 0;
    let lastDay: string | null = null;
    let lastLevelUpDay: string | null = null;
    const ordered = [...attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const attempt of ordered) {
        if (attempt.status !== "PERFECT" && attempt.status !== "COMPLETED") continue;
        const day = sofiaDay(attempt.createdAt);
        if (attempt.status === "PERFECT") {
            // Repeating a line many times on one day is practice, not proof of memory.
            if (day !== lastLevelUpDay) {
                level = Math.min(level + 1, REVIEW_INTERVALS.length - 1);
                lastLevelUpDay = day;
            }
        } else {
            // Gentle drop: one slip should not erase weeks of good work.
            level = Math.max(0, level - 2);
        }
        lastDay = day;
    }

    if (!lastDay) return null;
    return { level, lastDay, dueDay: addDays(lastDay, REVIEW_INTERVALS[level]) };
}

export function isLineMastered(attempts: LineAttempt[]): boolean {
    const runs = attempts
        .filter(attempt => attempt.status === "PERFECT" || attempt.status === "COMPLETED")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let steps = 0;
    for (const run of runs) steps = run.status === "PERFECT" ? steps + 1 : Math.max(0, steps - 1);
    if (steps < MASTERY_STEPS) return false;
    if (runs.length <= MASTERY_CHECK_AFTER_RUNS) return true;

    const recent = runs.slice(-MASTERY_RECENT_RUNS);
    return recent.filter(run => run.status === "PERFECT").length >= MASTERY_PERFECT_SHARE * recent.length;
}

export function isDue(state: LineReviewState, today: string): boolean {
    return state.dueDay <= today;
}
