import { WEEKLY_GOAL_DAYS, type PlaySessionRecord, type PracticeAttemptRecord, type PracticeInfo, type PuzzleAttemptRecord } from "./dailyMission";
import { sofiaDay, weekDays } from "./reviewSchedule";
import { summarizeStudent } from "./studentSummary";

// Effort points reward showing up and remembering, not rating: every child can top this board.
export const EFFORT_POINTS = { activeDay: 10, masteredLine: 5, puzzle: 1, playSession: 2 };
// Grinding puzzles all week should not beat coming back on different days.
export const MAX_PUZZLE_POINTS = 50;
// Fun modes help, but cannot outweigh review and practice.
export const MAX_PLAY_POINTS = 20;

export interface WeeklyEffort {
    activeDays: number;
    masteredThisWeek: number;
    puzzlesTried: number;
    playSessions: number;
    ratingChange: number;
    effortPoints: number;
    reachedGoal: boolean;
}

export function weeklyEffort({ now, practiceAttempts, puzzleAttempts, practices, playSessions = [] }: {
    now: Date;
    practiceAttempts: PracticeAttemptRecord[];
    puzzleAttempts: PuzzleAttemptRecord[];
    practices: Map<string, PracticeInfo>;
    playSessions?: PlaySessionRecord[];
}): WeeklyEffort {
    const summary = summarizeStudent({ now, practiceAttempts, puzzleAttempts, practices, playSessions });
    const week = new Set(weekDays(sofiaDay(now)));
    const thisWeek = puzzleAttempts.filter(attempt => week.has(sofiaDay(attempt.createdAt)));
    const puzzlesTried = thisWeek.length;
    const playThisWeek = playSessions.filter(session => week.has(sofiaDay(session.createdAt))).length;

    return {
        activeDays: summary.activeDaysThisWeek,
        masteredThisWeek: summary.masteredThisWeek,
        puzzlesTried,
        playSessions: playThisWeek,
        ratingChange: thisWeek.reduce((sum, attempt) => sum + (attempt.points ?? 0), 0),
        effortPoints: summary.activeDaysThisWeek * EFFORT_POINTS.activeDay
            + summary.masteredThisWeek * EFFORT_POINTS.masteredLine
            + Math.min(puzzlesTried * EFFORT_POINTS.puzzle, MAX_PUZZLE_POINTS)
            + Math.min(playThisWeek * EFFORT_POINTS.playSession, MAX_PLAY_POINTS),
        reachedGoal: summary.activeDaysThisWeek >= WEEKLY_GOAL_DAYS,
    };
}
