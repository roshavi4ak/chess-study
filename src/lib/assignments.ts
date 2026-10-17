import { levelKey } from "./curriculum";
import { isCompletion, type PlaySessionRecord, type PracticeAttemptRecord, type PuzzleAttemptRecord } from "./dailyMission";

export interface AssignmentRecord {
    id: string;
    kind: "PRACTICE" | "PUZZLE_THEME" | "LEVEL";
    studentId: string | null;
    practiceId: string | null;
    practiceName: string | null;
    tag: string | null; // Puzzle theme, or the level id for LEVEL homework
    target: number;
    note: string | null;
    dueOn: string; // Sofia calendar day, inclusive
    createdAt: Date;
}

export interface AssignmentProgress extends AssignmentRecord {
    done: number;
    complete: boolean;
    overdue: boolean;
}

// Only work done after the coach set the homework counts towards it.
export function getAssignmentProgress(
    assignment: AssignmentRecord,
    practiceAttempts: PracticeAttemptRecord[],
    puzzleAttempts: PuzzleAttemptRecord[],
    today: string,
    playSessions: PlaySessionRecord[] = [],
): AssignmentProgress {
    const since = assignment.createdAt.getTime();
    let done = 0;
    if (assignment.kind === "PRACTICE") {
        const lines = new Set(practiceAttempts
            .filter(attempt => attempt.practiceId === assignment.practiceId && isCompletion(attempt.status) && attempt.createdAt.getTime() >= since)
            .map(attempt => attempt.nodeId));
        done = lines.size;
    } else if (assignment.kind === "LEVEL") {
        done = playSessions.some(session => session.kind === "LEVEL_TEST" && session.won && session.key === levelKey(assignment.tag ?? "") && session.createdAt.getTime() >= since) ? 1 : 0;
    } else {
        done = puzzleAttempts
            .filter(attempt => assignment.tag && attempt.tags.includes(assignment.tag) && attempt.createdAt.getTime() >= since)
            .length;
    }
    const complete = done >= assignment.target;
    return { ...assignment, done: Math.min(done, assignment.target), complete, overdue: !complete && assignment.dueOn < today };
}

// Children see homework until its due day has passed; finished or not, old homework then disappears for them.
export function isVisibleToStudent(assignment: AssignmentRecord, today: string) {
    return assignment.dueOn >= today;
}
