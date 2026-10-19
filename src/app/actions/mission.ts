"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildDailyMission, type DailyMission } from "@/lib/dailyMission";
import { getAssignmentProgress, isVisibleToStudent, type AssignmentProgress } from "@/lib/assignments";
import { loadProgressHistory, puzzleHistoryStart, toAssignmentRecord } from "@/lib/progressHistory";
import { sofiaDay } from "@/lib/reviewSchedule";
import { loadPuzzleReviews } from "@/lib/puzzleReviewService";

export type MissionView = DailyMission & { homework: AssignmentProgress[]; puzzleReview: { target: number; done: number } };

async function loadMission(userId: string): Promise<MissionView> {
    const now = new Date();
    const today = sofiaDay(now);
    const assignmentRows = await prisma.assignment.findMany({
        where: { OR: [{ studentId: userId }, { studentId: null }], dueOn: { gte: new Date(`${today}T00:00:00Z`) } },
        include: { practice: { select: { name: true } } },
        orderBy: { dueOn: "asc" },
    }).catch(error => {
        // Usually the Assignment table does not exist yet; the rest of the mission still works.
        console.error("[Mission] Could not load homework:", error);
        return [];
    });
    const assignments = assignmentRows.map(toAssignmentRecord).filter(assignment => isVisibleToStudent(assignment, today));

    const history = await loadProgressHistory([userId], puzzleHistoryStart(now, assignments));
    const practiceAttempts = history.practiceAttempts.get(userId)!;
    const puzzleAttempts = history.puzzleAttempts.get(userId)!;

    const puzzleReview = await loadPuzzleReviews(userId, now);
    const mission = buildDailyMission({ now, practiceAttempts, puzzleAttempts, practices: history.practices, playSessions: history.playSessions.get(userId)! });
    return {
        ...mission,
        complete: mission.complete && puzzleReview.done >= puzzleReview.target,
        puzzleReview: { target: puzzleReview.target, done: puzzleReview.done },
        homework: assignments.map(assignment => getAssignmentProgress(assignment, practiceAttempts, puzzleAttempts, today, history.playSessions.get(userId)!)),
    };
}

export async function getDailyMission(): Promise<MissionView | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    return loadMission(session.user.id);
}

// Today's review lines for one practice that are still waiting to be played.
export async function getDueLineIds(practiceId: string): Promise<string[]> {
    const session = await auth();
    if (!session?.user?.id) return [];
    const mission = await loadMission(session.user.id);
    const group = mission.review.find(entry => entry.practiceId === practiceId);
    return group ? group.lineIds.filter(id => !group.doneIds.includes(id)) : [];
}
