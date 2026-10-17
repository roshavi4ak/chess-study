import { Chess } from "chess.js";
import { prisma } from "@/lib/db";
import { getAssignmentProgress, type AssignmentProgress } from "@/lib/assignments";
import { isCompletion, isSkillTag, type PlaySessionRecord, type PracticeAttemptRecord, type PracticeInfo, type PuzzleAttemptRecord } from "@/lib/dailyMission";
import { CURRICULUM } from "@/lib/curriculum";
import { loadLevel, type MyLevel } from "@/lib/levelProgress";
import { toAssignmentRecord } from "@/lib/progressHistory";
import { addDays, getLineReviewState, isDue, isLineMastered, sofiaDay } from "@/lib/reviewSchedule";
import { summarizeStudent, type StudentSummary } from "@/lib/studentSummary";

// Everything a child has done on the site, for the coach's student profile page. Server-side only.

export const ACTIVITY_DAYS = 120;
const RECENT_PUZZLES = 60;
const RECENT_PLAY = 60;
const TIMELINE_LENGTH = 150;
const RATING_POINTS = 200;
const WEAK_THEME_MIN_TRIES = 5;
const WEAK_THEME_MAX_SUCCESS = 0.6;

export interface ProfileLine {
    nodeId: string;
    lineNumber: number | null;
    moves: string; // "1. e4 e5 2. Nf3 …"
    attempts: number; // Completed attempts
    perfect: number;
    withMistakes: number; // Completed, but with wrong moves or hints
    unfinished: number;
    mistakes: number; // Wrong moves recorded (only counted since mistakes were stored)
    lastStatus: string | null;
    lastAttemptAt: Date | null;
    reviewLevel: number;
    mastered: boolean;
    due: boolean;
}

export interface ProfilePractice {
    id: string;
    name: string;
    playerColor: "WHITE" | "BLACK";
    totalLines: number;
    seenLines: number;
    masteredLines: number;
    dueLines: number;
    attempts: number;
    perfectAttempts: number;
    mistakes: number;
    lastAttemptAt: Date | null;
    lines: ProfileLine[];
}

export interface ProfileTheme {
    tag: string;
    tried: number;
    solved: number;
}

export interface ProfilePuzzle {
    id: string;
    name: string;
    rating: number;
    tags: string[];
    success: boolean;
    points: number;
    createdAt: Date;
}

export interface ProfilePlayKind {
    kind: string;
    count: number;
    wins: number;
    best: number;
    last: Date;
}

export interface ProfilePlay {
    kind: string;
    key: string;
    score: number;
    won: boolean | null;
    details: unknown;
    createdAt: Date;
}

export type TimelineEvent =
    | { type: "puzzle"; at: Date; name: string; rating: number; success: boolean; points: number }
    | { type: "practice"; at: Date; practiceId: string; practice: string; lineNumber: number | null; status: string; mistakes: number }
    | { type: "play"; at: Date; kind: string; key: string; score: number; won: boolean | null }
    | { type: "opening"; at: Date; openingId: string; opening: string; completed: boolean };

export interface Suggestion {
    kind: "PRACTICE" | "PUZZLE_THEME" | "LEVEL";
    reason: "weakLine" | "dueLines" | "weakTheme" | "level";
    practiceId?: string;
    practiceName?: string;
    lineNumber?: number | null;
    tag?: string;
    target: number;
    detail: number; // mistakes, due lines, success % — depends on reason
}

export interface StudentProfile {
    student: {
        id: string;
        name: string | null;
        image: string | null;
        lichessId: string | null;
        startLevel: string | null;
        ratings: { puzzle: number | null; bullet: number | null; blitz: number | null; rapid: number | null; classical: number | null };
        league: string;
    };
    today: string;
    summary: StudentSummary;
    level: MyLevel;
    totals: {
        puzzlesTried: number;
        puzzlesSolved: number;
        puzzlePoints: number;
        practiceAttempts: number;
        linesCompleted: number;
        linesPerfect: number;
        linesMastered: number;
        practiceMistakes: number;
        openingsViewed: number;
        openingsCompleted: number;
        playSessions: number;
        gamesRecorded: number;
        activeDays: number;
        firstActiveDay: string | null;
    };
    activity: { day: string; puzzles: number; lines: number; play: number }[];
    ratingHistory: number[];
    practices: ProfilePractice[];
    openings: { id: string; name: string; viewCount: number; completed: boolean; lastViewedAt: Date | null }[];
    themes: ProfileTheme[];
    recentPuzzles: ProfilePuzzle[];
    playKinds: ProfilePlayKind[];
    recentPlay: ProfilePlay[];
    levelTests: { levelId: string; score: number; passed: boolean; createdAt: Date }[];
    levelPractice: Record<string, number>; // practice rounds per level id
    games: { id: string; lichessGameId: string; opponentName: string | null; playerColor: string; result: string | null; openingName: string | null; playedAt: Date }[];
    homework: (AssignmentProgress & { coachId: string; coachName: string | null })[];
    suggestions: Suggestion[];
    timeline: TimelineEvent[];
}

function lineMoves(path: { fen: string; move: string | null }[]): string {
    const parts: string[] = [];
    for (let index = 1; index < path.length; index++) {
        const move = path[index].move;
        if (!move) continue;
        try {
            const game = new Chess(path[index - 1].fen);
            const played = game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
            const [, side, , , , fullMove] = path[index - 1].fen.split(" ");
            if (side === "w") parts.push(`${fullMove}. ${played.san}`);
            else parts.push(parts.length ? played.san : `${fullMove}… ${played.san}`);
        } catch {
            parts.push(move);
        }
    }
    return parts.join(" ");
}

export async function loadStudentProfile(studentId: string): Promise<StudentProfile | null> {
    const user = await prisma.user.findFirst({
        where: { id: studentId },
        select: {
            id: true, name: true, image: true, lichessId: true, startLevel: true,
            ratingPuzzle: true, ratingBullet: true, ratingBlitz: true, ratingRapid: true, ratingClassical: true,
        },
    });
    if (!user) return null;

    const now = new Date();
    const today = sofiaDay(now);
    const [practiceRows, puzzleRows, playRows, openingRows, gameRows, assignmentRows, league, level] = await Promise.all([
        prisma.practiceAttempt.findMany({
            where: { userId: studentId },
            select: { practiceId: true, nodeId: true, status: true, mistakes: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        }),
        prisma.puzzleAttempt.findMany({
            where: { userId: studentId },
            select: { success: true, points: true, createdAt: true, puzzle: { select: { id: true, name: true, rating: true, tags: true } } },
            orderBy: { createdAt: "asc" },
        }),
        prisma.playSession.findMany({
            where: { userId: studentId },
            select: { kind: true, key: true, score: true, won: true, details: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        }).catch(() => []),
        prisma.openingProgress.findMany({
            where: { userId: studentId },
            select: { viewCount: true, completed: true, lastViewedAt: true, opening: { select: { id: true, name: true } } },
            orderBy: { lastViewedAt: "desc" },
        }),
        prisma.gameRecord.findMany({ where: { userId: studentId }, orderBy: { playedAt: "desc" }, take: 50 }),
        prisma.assignment.findMany({
            where: { OR: [{ studentId }, { studentId: null }] },
            include: { practice: { select: { name: true } }, coach: { select: { name: true } } },
            orderBy: [{ dueOn: "desc" }, { createdAt: "desc" }],
        }).catch(() => []),
        prisma.leagueMembership.findUnique({ where: { userId: studentId }, select: { tier: true } }).catch(() => null),
        loadLevel(studentId),
    ]);

    // Practice trees for every practice the child touched or was given as homework.
    const practiceIds = new Set([...practiceRows.map(row => row.practiceId), ...assignmentRows.flatMap(row => row.practiceId ? [row.practiceId] : [])]);
    const practiceTrees = await prisma.practice.findMany({
        where: { id: { in: [...practiceIds] } },
        select: { id: true, name: true, playerColor: true, nodes: { select: { id: true, parentId: true, fen: true, move: true, lineNumber: true } } },
    });
    const practiceInfo = new Map<string, PracticeInfo>();

    const practiceAttempts: PracticeAttemptRecord[] = practiceRows.map(({ practiceId, nodeId, status, createdAt }) => ({ practiceId, nodeId, status, createdAt }));
    const attemptsByLine = new Map<string, typeof practiceRows>();
    for (const row of practiceRows) {
        const key = `${row.practiceId}:${row.nodeId}`;
        attemptsByLine.set(key, [...(attemptsByLine.get(key) ?? []), row]);
    }

    const practices: ProfilePractice[] = practiceTrees.map(practice => {
        const byId = new Map(practice.nodes.map(node => [node.id, node]));
        const parents = new Set(practice.nodes.map(node => node.parentId));
        const leaves = practice.nodes.filter(node => !parents.has(node.id) && node.parentId !== null);
        practiceInfo.set(practice.id, { name: practice.name, leafIds: leaves.map(leaf => leaf.id) });
        const lines: ProfileLine[] = leaves.map(leaf => {
            const path: { fen: string; move: string | null }[] = [];
            for (let node: typeof leaf | undefined = leaf; node; node = node.parentId ? byId.get(node.parentId) : undefined) path.unshift(node);
            const attempts = attemptsByLine.get(`${practice.id}:${leaf.id}`) ?? [];
            const review = getLineReviewState(attempts);
            const last = attempts[attempts.length - 1];
            return {
                nodeId: leaf.id,
                lineNumber: leaf.lineNumber,
                moves: lineMoves(path),
                attempts: attempts.filter(attempt => isCompletion(attempt.status)).length,
                perfect: attempts.filter(attempt => attempt.status === "PERFECT").length,
                withMistakes: attempts.filter(attempt => attempt.status === "COMPLETED").length,
                unfinished: attempts.filter(attempt => attempt.status === "PARTIAL").length,
                mistakes: attempts.reduce((sum, attempt) => sum + attempt.mistakes, 0),
                lastStatus: last?.status ?? null,
                lastAttemptAt: last?.createdAt ?? null,
                reviewLevel: review?.level ?? 0,
                mastered: isLineMastered(attempts),
                due: review ? isDue(review, today) : false,
            };
        }).sort((a, b) => (a.lineNumber ?? Infinity) - (b.lineNumber ?? Infinity));
        const touched = lines.filter(line => line.lastAttemptAt);
        return {
            id: practice.id,
            name: practice.name,
            playerColor: practice.playerColor,
            totalLines: lines.length,
            seenLines: touched.length,
            masteredLines: lines.filter(line => line.mastered).length,
            dueLines: lines.filter(line => line.due).length,
            attempts: lines.reduce((sum, line) => sum + line.attempts, 0),
            perfectAttempts: lines.reduce((sum, line) => sum + line.perfect, 0),
            mistakes: lines.reduce((sum, line) => sum + line.mistakes, 0),
            lastAttemptAt: touched.reduce<Date | null>((latest, line) => !latest || line.lastAttemptAt! > latest ? line.lastAttemptAt : latest, null),
            lines,
        };
    }).sort((a, b) => (b.lastAttemptAt?.getTime() ?? 0) - (a.lastAttemptAt?.getTime() ?? 0));

    const puzzleAttempts: PuzzleAttemptRecord[] = puzzleRows.map(row => ({ success: row.success, points: row.points, createdAt: row.createdAt, tags: row.puzzle.tags }));
    const playSessions: PlaySessionRecord[] = playRows.map(({ kind, key, score, won, createdAt }) => ({ kind, key, score, won, createdAt }));

    // Puzzle themes over all time.
    const themeMap = new Map<string, ProfileTheme>();
    for (const attempt of puzzleAttempts) {
        for (const tag of attempt.tags) {
            if (!isSkillTag(tag)) continue;
            const theme = themeMap.get(tag) ?? { tag, tried: 0, solved: 0 };
            theme.tried += 1;
            if (attempt.success) theme.solved += 1;
            themeMap.set(tag, theme);
        }
    }
    const themes = [...themeMap.values()].sort((a, b) => b.tried - a.tried);

    // Rating after each of the last attempts, rebuilt backwards from the current rating.
    const ratingHistory: number[] = [];
    if (user.ratingPuzzle !== null) {
        let rating = user.ratingPuzzle;
        ratingHistory.unshift(rating);
        for (let index = puzzleRows.length - 1; index >= 0 && ratingHistory.length < RATING_POINTS; index--) {
            rating -= puzzleRows[index].points;
            ratingHistory.unshift(rating);
        }
    }

    // Daily activity.
    const firstDay = addDays(today, -(ACTIVITY_DAYS - 1));
    const activityMap = new Map<string, { day: string; puzzles: number; lines: number; play: number }>();
    for (let day = firstDay; day <= today; day = addDays(day, 1)) activityMap.set(day, { day, puzzles: 0, lines: 0, play: 0 });
    const allDays = new Set<string>();
    const count = (date: Date, field: "puzzles" | "lines" | "play") => {
        const day = sofiaDay(date);
        allDays.add(day);
        const entry = activityMap.get(day);
        if (entry) entry[field] += 1;
    };
    puzzleRows.forEach(row => count(row.createdAt, "puzzles"));
    practiceRows.forEach(row => count(row.createdAt, "lines"));
    playRows.forEach(row => count(row.createdAt, "play"));

    // Fun modes by kind.
    const kindMap = new Map<string, ProfilePlayKind>();
    for (const session of playRows) {
        const entry = kindMap.get(session.kind) ?? { kind: session.kind, count: 0, wins: 0, best: 0, last: session.createdAt };
        entry.count += 1;
        if (session.won) entry.wins += 1;
        entry.best = Math.max(entry.best, session.score);
        entry.last = session.createdAt;
        kindMap.set(session.kind, entry);
    }
    const levelPractice: Record<string, number> = {};
    for (const session of playRows) {
        if (session.kind === "LEVEL_PRACTICE") {
            const id = session.key.replace(/^level:/, "");
            levelPractice[id] = (levelPractice[id] ?? 0) + 1;
        }
    }

    const homework = assignmentRows.map(row => ({
        ...getAssignmentProgress(toAssignmentRecord(row), practiceAttempts, puzzleAttempts, today, playSessions),
        coachId: row.coachId,
        coachName: row.coach.name,
    }));

    const summary = summarizeStudent({ now, practiceAttempts, puzzleAttempts, practices: practiceInfo, playSessions });

    // Ways the coach can help, worst first.
    const suggestions: Suggestion[] = [];
    const weakLines = practices.flatMap(practice => practice.lines
        .filter(line => !line.mastered && (line.withMistakes + line.mistakes) > 0)
        .map(line => ({ practice, line, weight: line.withMistakes + line.mistakes })))
        .sort((a, b) => b.weight - a.weight);
    const seenPractices = new Set<string>();
    for (const { practice, line, weight } of weakLines) {
        if (seenPractices.has(practice.id) || seenPractices.size >= 3) continue;
        seenPractices.add(practice.id);
        suggestions.push({ kind: "PRACTICE", reason: "weakLine", practiceId: practice.id, practiceName: practice.name, lineNumber: line.lineNumber, target: Math.min(5, Math.max(3, practice.seenLines)), detail: weight });
    }
    const mostDue = [...practices].filter(practice => practice.dueLines > 0).sort((a, b) => b.dueLines - a.dueLines)[0];
    if (mostDue && !seenPractices.has(mostDue.id)) {
        suggestions.push({ kind: "PRACTICE", reason: "dueLines", practiceId: mostDue.id, practiceName: mostDue.name, target: Math.min(10, mostDue.dueLines), detail: mostDue.dueLines });
    }
    for (const theme of themes
        .filter(theme => theme.tried >= WEAK_THEME_MIN_TRIES && theme.solved / theme.tried < WEAK_THEME_MAX_SUCCESS)
        .sort((a, b) => a.solved / a.tried - b.solved / b.tried)
        .slice(0, 3)) {
        suggestions.push({ kind: "PUZZLE_THEME", reason: "weakTheme", tag: theme.tag, target: 10, detail: Math.round(100 * theme.solved / theme.tried) });
    }
    if (level.currentIndex < CURRICULUM.length && !level.passed.includes(level.currentId)) {
        suggestions.push({ kind: "LEVEL", reason: "level", tag: level.currentId, target: 1, detail: level.best[level.currentId] ?? 0 });
    }

    const lineNumbers = new Map(practiceTrees.flatMap(practice => practice.nodes.map(node => [node.id, node.lineNumber] as const)));
    const timeline: TimelineEvent[] = [
        ...puzzleRows.slice(-TIMELINE_LENGTH).map(row => ({ type: "puzzle" as const, at: row.createdAt, name: row.puzzle.name, rating: row.puzzle.rating, success: row.success, points: row.points })),
        ...practiceRows.slice(-TIMELINE_LENGTH).map(row => ({
            type: "practice" as const, at: row.createdAt, practiceId: row.practiceId,
            practice: practiceInfo.get(row.practiceId)?.name ?? "?",
            lineNumber: lineNumbers.get(row.nodeId) ?? null,
            status: row.status, mistakes: row.mistakes,
        })),
        ...playRows.slice(-TIMELINE_LENGTH).map(row => ({ type: "play" as const, at: row.createdAt, kind: row.kind, key: row.key, score: row.score, won: row.won })),
        ...openingRows.filter(row => row.lastViewedAt).map(row => ({ type: "opening" as const, at: row.lastViewedAt!, openingId: row.opening.id, opening: row.opening.name, completed: row.completed })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, TIMELINE_LENGTH);

    const sortedDays = [...allDays].sort();
    return {
        student: {
            id: user.id,
            name: user.name,
            image: user.image,
            lichessId: user.lichessId,
            startLevel: user.startLevel,
            ratings: { puzzle: user.ratingPuzzle, bullet: user.ratingBullet, blitz: user.ratingBlitz, rapid: user.ratingRapid, classical: user.ratingClassical },
            league: league?.tier ?? "WOOD",
        },
        today,
        summary,
        level,
        totals: {
            puzzlesTried: puzzleRows.length,
            puzzlesSolved: puzzleRows.filter(row => row.success).length,
            puzzlePoints: puzzleRows.reduce((sum, row) => sum + row.points, 0),
            practiceAttempts: practiceRows.length,
            linesCompleted: practices.reduce((sum, practice) => sum + practice.lines.filter(line => line.attempts > 0).length, 0),
            linesPerfect: practices.reduce((sum, practice) => sum + practice.lines.filter(line => line.perfect > 0).length, 0),
            linesMastered: practices.reduce((sum, practice) => sum + practice.masteredLines, 0),
            practiceMistakes: practiceRows.reduce((sum, row) => sum + row.mistakes, 0),
            openingsViewed: openingRows.length,
            openingsCompleted: openingRows.filter(row => row.completed).length,
            playSessions: playRows.length,
            gamesRecorded: gameRows.length,
            activeDays: allDays.size,
            firstActiveDay: sortedDays[0] ?? null,
        },
        activity: [...activityMap.values()],
        ratingHistory,
        practices,
        openings: openingRows.map(row => ({ id: row.opening.id, name: row.opening.name, viewCount: row.viewCount, completed: row.completed, lastViewedAt: row.lastViewedAt })),
        themes,
        recentPuzzles: puzzleRows.slice(-RECENT_PUZZLES).reverse().map(row => ({ ...row.puzzle, success: row.success, points: row.points, createdAt: row.createdAt })),
        playKinds: [...kindMap.values()].sort((a, b) => b.count - a.count),
        recentPlay: playRows.slice(-RECENT_PLAY).reverse(),
        levelTests: playRows.filter(row => row.kind === "LEVEL_TEST").reverse().map(row => ({ levelId: row.key.replace(/^level:/, ""), score: row.score, passed: !!row.won, createdAt: row.createdAt })),
        levelPractice,
        games: gameRows.map(({ id, lichessGameId, opponentName, playerColor, result, openingName, playedAt }) => ({ id, lichessGameId, opponentName, playerColor, result, openingName, playedAt })),
        homework,
        suggestions,
        timeline,
    };
}
