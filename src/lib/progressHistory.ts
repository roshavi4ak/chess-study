import { prisma } from "@/lib/db";
import type { PlaySessionRecord, PracticeAttemptRecord, PracticeInfo, PuzzleAttemptRecord } from "@/lib/dailyMission";
import type { AssignmentRecord } from "@/lib/assignments";
import type { Assignment, Practice } from "@prisma/client";

// Enough puzzle history for the weak-theme window plus the current week.
export const PUZZLE_HISTORY_DAYS = 38;

export interface ProgressHistory {
    practiceAttempts: Map<string, PracticeAttemptRecord[]>;
    puzzleAttempts: Map<string, PuzzleAttemptRecord[]>;
    playSessions: Map<string, PlaySessionRecord[]>;
    practices: Map<string, PracticeInfo>;
}

// All practice history and recent puzzle history for the given students, keyed by user id.
export async function loadProgressHistory(userIds: string[], puzzlesSince: Date, extraPracticeIds: string[] = []): Promise<ProgressHistory> {
    const [practiceRows, puzzleRows, playRows] = await Promise.all([
        prisma.practiceAttempt.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, practiceId: true, nodeId: true, status: true, createdAt: true },
        }),
        prisma.puzzleAttempt.findMany({
            where: { userId: { in: userIds }, createdAt: { gte: puzzlesSince } },
            select: { userId: true, success: true, points: true, createdAt: true, puzzle: { select: { tags: true } } },
        }),
        prisma.playSession.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, kind: true, key: true, score: true, won: true, createdAt: true },
        }).catch(error => {
            // Usually the PlaySession table does not exist yet; everything else still works.
            console.error("[ProgressHistory] Could not load play sessions:", error);
            return [];
        }),
    ]);

    const practiceIds = new Set([...practiceRows.map(row => row.practiceId), ...extraPracticeIds]);
    const practiceTrees = await prisma.practice.findMany({
        where: { id: { in: [...practiceIds] } },
        select: { id: true, name: true, nodes: { select: { id: true, parentId: true } } },
    });
    const practices = new Map<string, PracticeInfo>(practiceTrees.map(practice => {
        const parents = new Set(practice.nodes.map(node => node.parentId));
        return [practice.id, { name: practice.name, leafIds: practice.nodes.filter(node => !parents.has(node.id)).map(node => node.id) }];
    }));

    const practiceAttempts = new Map<string, PracticeAttemptRecord[]>(userIds.map(id => [id, []]));
    for (const { userId, ...attempt } of practiceRows) practiceAttempts.get(userId)!.push(attempt);
    const puzzleAttempts = new Map<string, PuzzleAttemptRecord[]>(userIds.map(id => [id, []]));
    for (const row of puzzleRows) {
        puzzleAttempts.get(row.userId)!.push({ success: row.success, points: row.points, createdAt: row.createdAt, tags: row.puzzle.tags });
    }

    const playSessions = new Map<string, PlaySessionRecord[]>(userIds.map(id => [id, []]));
    for (const { userId, ...session } of playRows) playSessions.get(userId)!.push(session);

    return { practiceAttempts, puzzleAttempts, playSessions, practices };
}

export function puzzleHistoryStart(now: Date, assignments: { createdAt: Date }[] = []) {
    const window = now.getTime() - PUZZLE_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    return new Date(Math.min(window, ...assignments.map(assignment => assignment.createdAt.getTime())));
}

// @db.Date values arrive as UTC midnight of the stored calendar day.
export function toAssignmentRecord(assignment: Assignment & { practice: Pick<Practice, "name"> | null }): AssignmentRecord {
    return {
        id: assignment.id,
        kind: assignment.kind,
        studentId: assignment.studentId,
        practiceId: assignment.practiceId,
        practiceName: assignment.practice?.name ?? null,
        tag: assignment.tag,
        target: assignment.target,
        note: assignment.note,
        dueOn: assignment.dueOn.toISOString().slice(0, 10),
        createdAt: assignment.createdAt,
    };
}
