import { addDays, getLineReviewState, isDue, sofiaDay, weekDays, type AttemptStatus, type LineReviewState } from "./reviewSchedule";

export const MAX_REVIEW_LINES = 5;
export const PUZZLE_TARGET = 3;
export const WEEKLY_GOAL_DAYS = 4;
const WEAK_THEME_WINDOW_DAYS = 30;
const WEAK_THEME_MIN_ATTEMPTS = 3;
const WEAK_THEME_MIN_FAIL_RATE = 1 / 3;
const ACTIVE_DAY_PUZZLES = 3;

// Lichess themes that describe phase, length or evaluation rather than a skill to practise.
const NON_SKILL_TAGS = new Set([
    "opening", "middlegame", "endgame", "advantage", "crushing", "equality", "mate",
    "oneMove", "short", "long", "veryLong", "master", "masterVsMaster", "superGM",
]);

export interface PracticeAttemptRecord {
    practiceId: string;
    nodeId: string;
    status: AttemptStatus;
    createdAt: Date;
}

export interface PuzzleAttemptRecord {
    success: boolean;
    tags: string[];
    // Puzzle rating change from this attempt (0 for retries).
    points?: number;
    createdAt: Date;
}

export interface PlaySessionRecord {
    kind: string;
    key: string;
    score: number;
    won: boolean | null;
    createdAt: Date;
}

export interface PracticeInfo {
    name: string;
    leafIds: string[];
}

export interface ReviewGroup {
    practiceId: string;
    practiceName: string;
    lineIds: string[];
    doneIds: string[];
}

export interface DailyMission {
    today: string;
    review: ReviewGroup[];
    reviewTotal: number;
    reviewDone: number;
    dueCount: number;
    newLine: { practiceId: string; practiceName: string; done: boolean } | null;
    hasPracticed: boolean;
    puzzles: { tag: string | null; target: number; done: number };
    week: { days: { day: string; active: boolean }[]; activeCount: number; goal: number };
    complete: boolean;
}

export function isCompletion(status: AttemptStatus) {
    return status === "PERFECT" || status === "COMPLETED";
}

export function isSkillTag(tag: string) {
    return !NON_SKILL_TAGS.has(tag);
}

// Completed attempts per line ("practiceId:nodeId"), limited to lines that are still leaves of their practice.
export function groupLineHistories(practiceAttempts: PracticeAttemptRecord[], practices: Map<string, PracticeInfo>) {
    const leafSets = new Map([...practices].map(([id, info]) => [id, new Set(info.leafIds)]));
    const byLine = new Map<string, PracticeAttemptRecord[]>();
    for (const attempt of practiceAttempts) {
        if (!isCompletion(attempt.status) || !leafSets.get(attempt.practiceId)?.has(attempt.nodeId)) continue;
        const key = `${attempt.practiceId}:${attempt.nodeId}`;
        byLine.set(key, [...(byLine.get(key) ?? []), attempt]);
    }
    return byLine;
}

function weakestTheme(attempts: PuzzleAttemptRecord[]): string | null {
    const stats = new Map<string, { attempts: number; failed: number }>();
    for (const attempt of attempts) {
        for (const tag of attempt.tags) {
            if (!isSkillTag(tag)) continue;
            const entry = stats.get(tag) ?? { attempts: 0, failed: 0 };
            entry.attempts += 1;
            if (!attempt.success) entry.failed += 1;
            stats.set(tag, entry);
        }
    }
    const candidates = [...stats.entries()]
        .filter(([, s]) => s.attempts >= WEAK_THEME_MIN_ATTEMPTS && s.failed / s.attempts >= WEAK_THEME_MIN_FAIL_RATE)
        .sort(([, a], [, b]) => b.failed / b.attempts - a.failed / a.attempts || b.attempts - a.attempts);
    return candidates[0]?.[0] ?? null;
}

// The mission is built from history before today, so it stays the same while the child works through it.
export function buildDailyMission({ now, practiceAttempts, puzzleAttempts, practices, playSessions = [] }: {
    now: Date;
    practiceAttempts: PracticeAttemptRecord[];
    puzzleAttempts: PuzzleAttemptRecord[];
    practices: Map<string, PracticeInfo>;
    // Finished fun activities (streaks, races, bots, mini-games...); any one makes the day active.
    playSessions?: PlaySessionRecord[];
}): DailyMission {
    const today = sofiaDay(now);
    const completions = practiceAttempts.filter(attempt => isCompletion(attempt.status));
    const byLine = groupLineHistories(practiceAttempts, practices);

    const due: { attempt: PracticeAttemptRecord; state: LineReviewState; doneToday: boolean }[] = [];
    for (const attempts of byLine.values()) {
        const before = attempts.filter(attempt => sofiaDay(attempt.createdAt) < today);
        const state = getLineReviewState(before);
        if (state && isDue(state, today)) {
            due.push({ attempt: attempts[0], state, doneToday: before.length < attempts.length });
        }
    }
    due.sort((a, b) => a.state.level - b.state.level || a.state.dueDay.localeCompare(b.state.dueDay));

    const groups = new Map<string, ReviewGroup>();
    for (const { attempt, doneToday } of due.slice(0, MAX_REVIEW_LINES)) {
        const group = groups.get(attempt.practiceId) ?? {
            practiceId: attempt.practiceId,
            practiceName: practices.get(attempt.practiceId)!.name,
            lineIds: [],
            doneIds: [],
        };
        group.lineIds.push(attempt.nodeId);
        if (doneToday) group.doneIds.push(attempt.nodeId);
        groups.set(attempt.practiceId, group);
    }
    const review = [...groups.values()];
    const reviewTotal = review.reduce((sum, group) => sum + group.lineIds.length, 0);
    const reviewDone = review.reduce((sum, group) => sum + group.doneIds.length, 0);

    // With nothing to review, suggest one new line in the most recently practised opening that still has some.
    let newLine: DailyMission["newLine"] = null;
    if (reviewTotal === 0) {
        const firstDay = new Map<string, string>();
        const lastPractised = new Map<string, number>();
        for (const attempt of completions) {
            const key = `${attempt.practiceId}:${attempt.nodeId}`;
            const day = sofiaDay(attempt.createdAt);
            if (!firstDay.has(key) || day < firstDay.get(key)!) firstDay.set(key, day);
            if (day < today) {
                lastPractised.set(attempt.practiceId, Math.max(lastPractised.get(attempt.practiceId) ?? 0, attempt.createdAt.getTime()));
            }
        }
        const practiceId = [...lastPractised.entries()]
            .sort(([, a], [, b]) => b - a)
            .map(([id]) => id)
            .find(id => practices.get(id)?.leafIds.some(leaf => {
                const first = firstDay.get(`${id}:${leaf}`);
                return !first || first === today;
            }));
        if (practiceId) {
            newLine = {
                practiceId,
                practiceName: practices.get(practiceId)!.name,
                done: practices.get(practiceId)!.leafIds.some(leaf => firstDay.get(`${practiceId}:${leaf}`) === today),
            };
        }
    }

    const windowStart = addDays(today, -WEAK_THEME_WINDOW_DAYS);
    const tag = weakestTheme(puzzleAttempts.filter(attempt => {
        const day = sofiaDay(attempt.createdAt);
        return day >= windowStart && day < today;
    }));
    const puzzlesToday = puzzleAttempts.filter(attempt => sofiaDay(attempt.createdAt) === today);
    const puzzlesDone = (tag ? puzzlesToday.filter(attempt => attempt.tags.includes(tag)) : puzzlesToday).length;

    const days = weekDays(today).map(day => ({
        day,
        active: completions.some(attempt => sofiaDay(attempt.createdAt) === day)
            || puzzleAttempts.filter(attempt => sofiaDay(attempt.createdAt) === day).length >= ACTIVE_DAY_PUZZLES
            || playSessions.some(session => sofiaDay(session.createdAt) === day),
    }));

    return {
        today,
        review,
        reviewTotal,
        reviewDone,
        dueCount: due.length,
        newLine,
        hasPracticed: completions.length > 0,
        puzzles: { tag, target: PUZZLE_TARGET, done: Math.min(puzzlesDone, PUZZLE_TARGET) },
        week: { days, activeCount: days.filter(day => day.active).length, goal: WEEKLY_GOAL_DAYS },
        complete: reviewDone >= reviewTotal && (newLine?.done ?? true) && puzzlesDone >= PUZZLE_TARGET,
    };
}
