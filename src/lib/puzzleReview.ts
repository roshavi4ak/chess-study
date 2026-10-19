import { addDays, sofiaDay } from "./reviewSchedule";

export const PUZZLE_REVIEW_LIMIT = 3;
export const PUZZLE_REVIEW_INTERVALS = [1, 3, 7, 14, 30];
export interface ReviewAttempt { puzzleId: string; success: boolean; createdAt: Date }

// A failed/assisted day wins over same-day retries. Memory is tested on later days.
export function puzzleReviewState(attempts: ReviewAttempt[]) {
    const days = new Map<string, boolean>();
    for (const attempt of attempts) {
        const day = sofiaDay(attempt.createdAt);
        days.set(day, (days.get(day) ?? true) && attempt.success);
    }
    let level = 0;
    let dueOn: string | null = null;
    for (const [day, success] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
        if (!success) { level = 0; dueOn = addDays(day, 1); }
        // Early successes do not push the date forward or increase mastery.
        else if (dueOn && day >= dueOn) {
            level = Math.min(level + 1, PUZZLE_REVIEW_INTERVALS.length - 1);
            dueOn = addDays(day, PUZZLE_REVIEW_INTERVALS[level]);
        }
    }
    return dueOn ? { level, dueOn } : null;
}

export function selectPuzzleReviews(attempts: ReviewAttempt[], now: Date) {
    const today = sofiaDay(now);
    const groups = new Map<string, ReviewAttempt[]>();
    for (const attempt of attempts) groups.set(attempt.puzzleId, [...(groups.get(attempt.puzzleId) ?? []), attempt]);
    return [...groups].flatMap(([puzzleId, history]) => {
        // Stable selection throughout the day, even after answering or reloading.
        const state = puzzleReviewState(history.filter(attempt => sofiaDay(attempt.createdAt) < today));
        return state && state.dueOn <= today ? [{ puzzleId, ...state, done: history.some(attempt => sofiaDay(attempt.createdAt) === today) }] : [];
    }).sort((a, b) => a.level - b.level || a.dueOn.localeCompare(b.dueOn) || a.puzzleId.localeCompare(b.puzzleId)).slice(0, PUZZLE_REVIEW_LIMIT);
}
