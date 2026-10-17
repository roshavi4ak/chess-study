"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getAssignmentProgress, type AssignmentProgress, type AssignmentRecord } from "@/lib/assignments";
import { isSkillTag } from "@/lib/dailyMission";
import { loadProgressHistory, puzzleHistoryStart, toAssignmentRecord } from "@/lib/progressHistory";
import { addDays, sofiaDay } from "@/lib/reviewSchedule";
import { summarizeStudent, type StudentSummary } from "@/lib/studentSummary";
import { findCurriculumLevel } from "@/lib/curriculum";

// Coaches keep seeing homework for two weeks after it was due.
const COACH_HISTORY_DAYS = 14;
const MAX_TARGET = 50;

async function requireCoach() {
    const session = await auth();
    if (session?.user?.role !== "COACH" || !session.user.id) throw new Error("Unauthorized");
    return session.user.id;
}

export interface AssignmentInput {
    studentId: string | null;
    kind: "PRACTICE" | "PUZZLE_THEME" | "LEVEL";
    practiceId?: string;
    tag?: string;
    target: number;
    dueOn: string;
    note?: string;
}

export async function createAssignment(input: AssignmentInput) {
    const coachId = await requireCoach();
    const target = input.kind === "LEVEL" ? 1 : Math.round(input.target);
    if (!Number.isFinite(target) || target < 1 || target > MAX_TARGET) throw new Error("Invalid target");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) || input.dueOn < sofiaDay(new Date())) throw new Error("Invalid due date");
    if (input.kind === "PRACTICE" && !input.practiceId) throw new Error("Choose a practice");
    if (input.kind === "PUZZLE_THEME" && !input.tag) throw new Error("Choose a puzzle theme");
    if (input.kind === "LEVEL" && !(input.tag && findCurriculumLevel(input.tag))) throw new Error("Choose a level");
    if (input.studentId && !(await prisma.user.findFirst({ where: { id: input.studentId, role: "STUDENT" } }))) {
        throw new Error("Unknown student");
    }

    await prisma.assignment.create({
        data: {
            coachId,
            studentId: input.studentId,
            kind: input.kind,
            practiceId: input.kind === "PRACTICE" ? input.practiceId : null,
            tag: input.kind === "PRACTICE" ? null : input.tag,
            target,
            dueOn: new Date(`${input.dueOn}T00:00:00Z`),
            note: input.note?.trim() || null,
        },
    });
    revalidatePath("/[locale]/coach/assignments", "page");
    revalidatePath("/[locale]/coach/students/[id]", "page");
}

export async function deleteAssignment(id: string) {
    const coachId = await requireCoach();
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment || assignment.coachId !== coachId) throw new Error("Unauthorized or not found");
    await prisma.assignment.delete({ where: { id } });
    revalidatePath("/[locale]/coach/assignments", "page");
    revalidatePath("/[locale]/coach/students/[id]", "page");
}

export interface StudentOverview {
    id: string;
    name: string | null;
    image: string | null;
    startLevel: string | null;
    summary: StudentSummary;
    homework: AssignmentProgress[];
}

export interface CoachOverview {
    today: string;
    students: StudentOverview[];
    assignments: (AssignmentRecord & { coachName: string | null; ownedByMe: boolean; progress: { studentId: string; done: number; complete: boolean }[] })[];
}

export async function getCoachOverview(): Promise<CoachOverview> {
    const coachId = await requireCoach();
    const now = new Date();
    const today = sofiaDay(now);

    const [students, assignmentRows] = await Promise.all([
        prisma.user.findMany({ where: { role: "STUDENT" }, select: { id: true, name: true, image: true, startLevel: true }, orderBy: { name: "asc" } }),
        prisma.assignment.findMany({
            where: { dueOn: { gte: new Date(`${addDays(today, -COACH_HISTORY_DAYS)}T00:00:00Z`) } },
            include: { practice: { select: { name: true } }, coach: { select: { name: true } } },
            orderBy: [{ dueOn: "asc" }, { createdAt: "asc" }],
        }),
    ]);
    const assignments = assignmentRows.map(row => ({ ...toAssignmentRecord(row), coachId: row.coachId, coachName: row.coach.name }));

    const history = await loadProgressHistory(students.map(student => student.id), puzzleHistoryStart(now, assignments));

    const overview = students.map(student => {
        const practiceAttempts = history.practiceAttempts.get(student.id)!;
        const puzzleAttempts = history.puzzleAttempts.get(student.id)!;
        return {
            ...student,
            summary: summarizeStudent({ now, practiceAttempts, puzzleAttempts, practices: history.practices, playSessions: history.playSessions.get(student.id)! }),
            homework: assignments
                .filter(assignment => assignment.studentId === null || assignment.studentId === student.id)
                .map(assignment => getAssignmentProgress(assignment, practiceAttempts, puzzleAttempts, today, history.playSessions.get(student.id)!)),
        };
    });

    return {
        today,
        students: overview,
        assignments: assignments.map(({ coachId: ownerId, coachName, ...assignment }) => ({
            ...assignment,
            coachName,
            ownedByMe: ownerId === coachId,
            progress: overview
                .map(student => ({ studentId: student.id, progress: student.homework.find(item => item.id === assignment.id) }))
                .filter(entry => entry.progress)
                .map(({ studentId, progress }) => ({ studentId, done: progress!.done, complete: progress!.complete })),
        })),
    };
}

// Choices for the homework form.
export async function getAssignmentOptions() {
    await requireCoach();
    const [practices, tags] = await Promise.all([
        prisma.practice.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.$queryRaw<{ tag: string; count: number }[]>`
            SELECT t.tag, COUNT(*)::int as count
            FROM "Puzzle", unnest(tags) as t(tag)
            GROUP BY t.tag
            ORDER BY count DESC
        `,
    ]);
    return { practices, tags: tags.filter(row => isSkillTag(row.tag)).map(row => row.tag) };
}
