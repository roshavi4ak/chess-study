// Team challenges and club goals: what a coach can measure, and how scores and progress are counted.
// Every measure counts activity between two Sofia calendar days, both included.

import { groupLineHistories, type PlaySessionRecord, type PracticeAttemptRecord, type PracticeInfo } from "./dailyMission";
import { addDays, isLineMastered, sofiaDay, weekDays } from "./reviewSchedule";

export const GOAL_METRICS = [
    "PUZZLES_SOLVED", // rated puzzles solved (optionally one theme)
    "PUZZLES_TRIED",
    "PUZZLE_POINTS", // leaderboard challenge points from puzzles
    "LINES_PLAYED", // opening lines played to the end (optionally one opening)
    "PERFECT_LINES",
    "LINES_MASTERED",
    "ACTIVE_DAYS",
    "FUN_GAMES", // finished Play & learn activities
    "BOT_WINS",
    "SOLO_SOLVED",
    "NOTATION_CORRECT",
    "LEVELS_PASSED",
    "TOURNAMENTS",
    "MANUAL", // only the points coaches add by hand
] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

export const THEME_METRICS: GoalMetric[] = ["PUZZLES_SOLVED", "PUZZLES_TRIED", "PUZZLE_POINTS"];
export const OPENING_METRICS: GoalMetric[] = ["LINES_PLAYED", "PERFECT_LINES", "LINES_MASTERED"];

// Take students straight to an activity that counts, keeping the challenge's theme/opening filter.
export function goalActivityHref(goal: Pick<GoalDefinition, "metric" | "tag" | "practiceId">): string | null {
    if (THEME_METRICS.includes(goal.metric)) return `/puzzles/play${goal.tag ? `?tag=${encodeURIComponent(goal.tag)}` : ""}`;
    if (OPENING_METRICS.includes(goal.metric)) return goal.practiceId ? `/practices/${encodeURIComponent(goal.practiceId)}` : "/practices";
    switch (goal.metric) {
        case "ACTIVE_DAYS": return "/puzzles/play";
        case "FUN_GAMES": return "/fun";
        case "BOT_WINS": return "/play/bots";
        case "SOLO_SOLVED": return "/fun/solo";
        case "NOTATION_CORRECT": return "/fun/notation";
        case "LEVELS_PASSED": return "/levels";
        case "TOURNAMENTS": return "/tournaments";
        case "MANUAL": return null;
    }
    return null;
}

export const TEAM_COLORS = ["red", "blue", "green", "yellow", "purple", "orange"] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];
export const MIN_TEAMS = 2;
export const MAX_TEAMS = TEAM_COLORS.length;
export const MAX_GOAL_DAYS = 366;

export type ChallengeScoring = "TOTAL" | "AVERAGE";

export interface GoalDefinition {
    metric: GoalMetric;
    tag: string | null;
    practiceId: string | null;
    startsOn: string; // "YYYY-MM-DD"
    endsOn: string;
}

export interface GoalPuzzleAttempt {
    success: boolean;
    tags: string[];
    challengePoints: number | null;
    createdAt: Date;
}

export interface GoalActivity {
    puzzleAttempts: GoalPuzzleAttempt[];
    practiceAttempts: PracticeAttemptRecord[];
    playSessions: PlaySessionRecord[];
}

export const isGoalMetric = (value: string): value is GoalMetric => (GOAL_METRICS as readonly string[]).includes(value);
export const isTeamColor = (value: string): value is TeamColor => (TEAM_COLORS as readonly string[]).includes(value);

// One child's contribution to a goal.
export function goalValue(goal: GoalDefinition, activity: GoalActivity, practices: Map<string, PracticeInfo>): number {
    const inRange = (date: Date) => {
        const day = sofiaDay(date);
        return day >= goal.startsOn && day <= goal.endsOn;
    };
    const puzzles = activity.puzzleAttempts.filter(attempt => inRange(attempt.createdAt) && (!goal.tag || attempt.tags.includes(goal.tag)));
    const lines = activity.practiceAttempts.filter(attempt => !goal.practiceId || attempt.practiceId === goal.practiceId);
    const linesInRange = lines.filter(attempt => inRange(attempt.createdAt));
    const plays = activity.playSessions.filter(session => inRange(session.createdAt));

    switch (goal.metric) {
        case "PUZZLES_SOLVED": return puzzles.filter(attempt => attempt.success).length;
        case "PUZZLES_TRIED": return puzzles.length;
        case "PUZZLE_POINTS": return puzzles.reduce((sum, attempt) => sum + (attempt.challengePoints ?? 0), 0);
        case "LINES_PLAYED": return linesInRange.filter(attempt => attempt.status === "PERFECT" || attempt.status === "COMPLETED").length;
        case "PERFECT_LINES": return linesInRange.filter(attempt => attempt.status === "PERFECT").length;
        case "LINES_MASTERED": {
            // Lines that became mastered during the period.
            let count = 0;
            for (const attempts of groupLineHistories(lines, practices).values()) {
                const untilEnd = attempts.filter(attempt => sofiaDay(attempt.createdAt) <= goal.endsOn);
                const beforeStart = attempts.filter(attempt => sofiaDay(attempt.createdAt) < goal.startsOn);
                if (isLineMastered(untilEnd) && !isLineMastered(beforeStart)) count += 1;
            }
            return count;
        }
        case "ACTIVE_DAYS": {
            const days = [...puzzles.map(attempt => attempt.createdAt), ...linesInRange.map(attempt => attempt.createdAt), ...plays.map(session => session.createdAt)];
            // A theme or opening filter narrows puzzles and lines; any finished game still counts as showing up.
            return new Set(days.map(sofiaDay)).size;
        }
        case "FUN_GAMES": return plays.length;
        case "BOT_WINS": return plays.filter(session => session.kind === "BOT_GAME" && session.won).length;
        case "SOLO_SOLVED": return plays.filter(session => session.kind === "SOLO_CHESS").length;
        case "NOTATION_CORRECT": return plays.filter(session => session.kind === "NOTATION").reduce((sum, session) => sum + session.score, 0);
        case "LEVELS_PASSED": return plays.filter(session => session.kind === "LEVEL_TEST" && session.won).length;
        case "TOURNAMENTS": return plays.filter(session => session.kind === "TOURNAMENT").length;
        case "MANUAL": return 0;
    }
}

export interface TeamInput {
    id: string;
    name: string;
    color: string;
    bonus: number;
    memberIds: string[];
}

export interface TeamStanding extends TeamInput {
    earned: number; // members' activity, before averaging and bonus
    score: number;
    rank: number;
}

// Rounded to one decimal place for averages.
const tidy = (value: number) => Math.round(value * 10) / 10;

// Team scores, best first; teams with the same score share a place.
export function teamStandings(teams: TeamInput[], valueByUser: Map<string, number>, scoring: ChallengeScoring): TeamStanding[] {
    const scored = teams.map(team => {
        const earned = team.memberIds.reduce((sum, id) => sum + (valueByUser.get(id) ?? 0), 0);
        const base = scoring === "AVERAGE" ? (team.memberIds.length ? earned / team.memberIds.length : 0) : earned;
        return { ...team, earned, score: tidy(base + team.bonus), rank: 0 };
    });
    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    scored.forEach((team, index) => {
        team.rank = index > 0 && team.score === scored[index - 1].score ? scored[index - 1].rank : index + 1;
    });
    return scored;
}

export function goalProgress(target: number, values: number[], bonus: number) {
    const total = values.reduce((sum, value) => sum + value, 0) + bonus;
    return { total, percent: target > 0 ? Math.min(100, Math.floor((total / target) * 100)) : 0, reached: total >= target };
}

export type GoalPhase = "upcoming" | "active" | "finished";

export function goalPhase(goal: Pick<GoalDefinition, "startsOn" | "endsOn">, today: string): GoalPhase {
    if (today < goal.startsOn) return "upcoming";
    return today > goal.endsOn ? "finished" : "active";
}

// Days left including today, for an active period.
export function daysLeft(endsOn: string, today: string) {
    return Math.round((new Date(`${endsOn}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000) + 1;
}

export type PeriodPreset = "thisWeek" | "nextWeek" | "thisMonth" | "nextMonth";
export const PERIOD_PRESETS: PeriodPreset[] = ["thisWeek", "nextWeek", "thisMonth", "nextMonth"];

// Monday–Sunday weeks and whole calendar months, in Sofia days.
export function presetPeriod(preset: PeriodPreset, today: string): { startsOn: string; endsOn: string } {
    if (preset === "thisWeek" || preset === "nextWeek") {
        const days = weekDays(preset === "thisWeek" ? today : addDays(today, 7));
        return { startsOn: days[0], endsOn: days[6] };
    }
    const [year, month] = today.split("-").map(Number);
    const first = preset === "thisMonth" ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, month, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    return { startsOn: first.toISOString().slice(0, 10), endsOn: last.toISOString().slice(0, 10) };
}

export function validPeriod(startsOn: string, endsOn: string) {
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!pattern.test(startsOn) || !pattern.test(endsOn)) return false;
    if (Number.isNaN(Date.parse(`${startsOn}T00:00:00Z`)) || Number.isNaN(Date.parse(`${endsOn}T00:00:00Z`))) return false;
    // The round trip rejects days such as 2026-02-30.
    if (addDays(startsOn, 0) !== startsOn || addDays(endsOn, 0) !== endsOn) return false;
    return endsOn >= startsOn && daysLeft(endsOn, startsOn) <= MAX_GOAL_DAYS;
}

// Splits children into teams by dealing them out in rating order (1-2-3-3-2-1...), so the teams are about equal.
export function balancedTeams<T extends { id: string; rating: number | null }>(students: T[], teamCount: number, random: () => number = Math.random): string[][] {
    const teams: string[][] = Array.from({ length: teamCount }, () => []);
    const shuffled = [...students].map(student => ({ student, tie: random() }))
        .sort((a, b) => (b.student.rating ?? 0) - (a.student.rating ?? 0) || a.tie - b.tie)
        .map(entry => entry.student);
    shuffled.forEach((student, index) => {
        const round = Math.floor(index / teamCount);
        const position = index % teamCount;
        teams[round % 2 === 0 ? position : teamCount - 1 - position].push(student.id);
    });
    return teams;
}
