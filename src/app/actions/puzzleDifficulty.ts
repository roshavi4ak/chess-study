"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { isPuzzleDifficulty, puzzleDifficulty, puzzleRatingRange, type PuzzleDifficultyView } from "@/lib/puzzleDifficulty";

type Result = { view: PuzzleDifficultyView } | { error: "unauthorized" | "notFound" | "invalid" | "locked" | "saveFailed" };

async function access(studentId?: string) {
    if (studentId !== undefined && (typeof studentId !== "string" || !studentId || studentId.length > 200)) return null;
    const session = await auth();
    if (!session?.user?.id || (studentId && session.user.role !== "COACH")) return null;
    return { id: studentId || session.user.id, coach: session.user.role === "COACH" };
}

export async function getPuzzleDifficulty(studentId?: string): Promise<Result> {
    const viewer = await access(studentId);
    if (!viewer) return { error: "unauthorized" };
    const user = await prisma.user.findUnique({ where: { id: viewer.id }, select: { role: true, ratingPuzzle: true, puzzleDifficulty: true } });
    if (!user || (studentId && user.role !== "STUDENT")) return { error: "notFound" };
    return { view: { ...puzzleRatingRange(user.ratingPuzzle, user.puzzleDifficulty), canEditLimits: viewer.coach } };
}

export async function savePuzzleDifficulty(input: unknown, studentId?: string): Promise<Result> {
    const viewer = await access(studentId);
    if (!viewer) return { error: "unauthorized" };
    if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "invalid" };
    const value = input as Record<string, unknown>;
    try {
        // Serialize coach and student edits so an old student request cannot
        // overwrite newer limits or permissions set by a coach.
        const result = await prisma.$transaction(async database => {
            await database.$queryRaw`SELECT id FROM "User" WHERE id = ${viewer.id} FOR UPDATE`;
            const user = await database.user.findUnique({ where: { id: viewer.id }, select: { role: true, ratingPuzzle: true, puzzleDifficulty: true } });
            if (!user || (studentId && user.role !== "STUDENT")) return { error: "notFound" } as const;
            const current = puzzleDifficulty(user.puzzleDifficulty);
            if (!viewer.coach && !current.allowStudentChoice) return { error: "locked" } as const;
            if (!viewer.coach && Object.keys(value).some(key => key !== "preferredOffset")) return { error: "invalid" } as const;
            const next = viewer.coach ? value : { ...current, preferredOffset: value.preferredOffset };
            if (!isPuzzleDifficulty(next)) return { error: "invalid" } as const;
            const settings = puzzleDifficulty(next);
            await database.user.update({ where: { id: viewer.id }, data: { puzzleDifficulty: { ...settings } } });
            return { view: { ...puzzleRatingRange(user.ratingPuzzle, settings), canEditLimits: viewer.coach } };
        });
        if ("view" in result) {
            revalidatePath("/[locale]/puzzles", "page");
            if (studentId) revalidatePath("/[locale]/coach/students/[id]", "page");
        }
        return result;
    } catch (error) {
        console.error("[PuzzleDifficulty] Could not save settings", error);
        return { error: "saveFailed" };
    }
}
