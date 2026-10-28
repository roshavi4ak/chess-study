import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { readMoveErrors } from "@/lib/attemptMoves";
import type { ReviewAttempt } from "@/components/AttemptReview";

// The current live installation is one school. Require a coach before loading another student's review.
export async function getReviewCoach() {
    const session = await auth();
    return session?.user?.role === "COACH" && session.user.id ? { coachId: session.user.id } : null;
}
export async function loadPuzzleMistakes(puzzleId: string): Promise<ReviewAttempt[]> {
    const rows = await prisma.puzzleAttempt.findMany({
        where: { puzzleId, success: false, user: { role: "STUDENT" } },
        select: { id: true, success: true, moveErrors: true, createdAt: true, user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
    });
    return rows.map(row => ({ id: row.id, student: row.user.name ?? "?", at: row.createdAt.toISOString(), success: row.success,
        errors: row.moveErrors === null ? null : readMoveErrors(row.moveErrors) }));
}

export function activityReviewHref(studentId: string, type: "puzzle" | "practice" | "play", attemptId: string) {
    return `/coach/students/${encodeURIComponent(studentId)}/activity/${type}/${encodeURIComponent(attemptId)}`;
}
