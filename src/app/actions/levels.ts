"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { CURRICULUM, KING_LEVEL, TEST_PUZZLES, findCurriculumLevel, levelKey, testPassed } from "@/lib/curriculum";
import { loadLevel, type MyLevel } from "@/lib/levelProgress";
import { loadLevelExercises } from "@/lib/puzzleQueries";
import { beginnerExercises, randomHangingExercises, type LevelExercise } from "@/lib/levelExercises";
import { validateExerciseReviews, type ExerciseReview } from "@/lib/attemptMoves";

export type { MyLevel };

async function requireUser() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user;
}

export async function getMyLevel(): Promise<MyLevel> {
    const user = await requireUser();
    return loadLevel(user.id!);
}

// The test puzzles for a level. Only open levels (passed ones or the current one) can be taken.
export async function getLevelTest(levelId: string): Promise<LevelExercise[]> {
    const user = await requireUser();
    const level = findCurriculumLevel(levelId);
    if (!level) throw new Error("Unknown level");
    const mine = await loadLevel(user.id!);
    const isOpen = level.id === KING_LEVEL.id ? mine.currentIndex >= CURRICULUM.length : (mine.passed.includes(level.id) || mine.currentId === level.id);
    if (!isOpen) throw new Error("This level is not open yet");
    const beginner = beginnerExercises(level.id);
    if (beginner) return beginner;
    const start = level.id === KING_LEVEL.id ? mine.kingRating : level.startRating;
    return loadLevelExercises(level, start);
}

// Practice exercises for a level: the same topic and difficulty as its test, a fresh set every time.
export async function getLevelPractice(levelId: string): Promise<LevelExercise[]> {
    const user = await requireUser();
    const level = findCurriculumLevel(levelId);
    if (!level) throw new Error("Unknown level");
    if (beginnerExercises(level.id)) return randomHangingExercises(TEST_PUZZLES);
    const start = level.id === KING_LEVEL.id ? (await loadLevel(user.id!)).kingRating : level.startRating;
    return loadLevelExercises(level, start);
}

// A finished practice round. Kept for the coach's view of the child's activity; it never affects passing.
export async function recordLevelPractice(levelId: string, correct: number, total: number, reviews?: ExerciseReview[]) {
    const user = await requireUser();
    const level = findCurriculumLevel(levelId);
    if (!level) throw new Error("Unknown level");
    const safeTotal = Math.max(1, Math.min(TEST_PUZZLES, Math.round(total)));
    const score = Math.max(0, Math.min(safeTotal, Math.round(correct)));
    const exercises = reviews ? validateExerciseReviews(reviews) : undefined;
    await prisma.playSession.create({ data: { userId: user.id!, kind: "LEVEL_PRACTICE", key: levelKey(level.id), score, details: { total: safeTotal, ...(exercises ? { exercises } : {}) } } })
        .catch(error => console.error("[Levels] Could not save practice round:", error));
}

export async function submitLevelTest(levelId: string, correct: number, reviews?: ExerciseReview[]): Promise<{ passed: boolean }> {
    const user = await requireUser();
    const level = findCurriculumLevel(levelId);
    if (!level) throw new Error("Unknown level");
    const score = Math.max(0, Math.min(TEST_PUZZLES, Math.round(correct)));
    const passed = testPassed(score);
    const exercises = reviews ? validateExerciseReviews(reviews) : undefined;
    await prisma.playSession.create({ data: { userId: user.id!, kind: "LEVEL_TEST", key: levelKey(level.id), score, won: passed, ...(exercises ? { details: { exercises } } : {}) } });
    return { passed };
}

// Coach: place a child at a level (earlier levels count as passed). null = start from the beginning.
export async function setStartLevel(studentId: string, levelId: string | null) {
    const session = await auth();
    if (session?.user?.role !== "COACH") throw new Error("Unauthorized");
    if (levelId !== null && !CURRICULUM.some(entry => entry.id === levelId)) throw new Error("Unknown level");
    await prisma.user.update({ where: { id: studentId }, data: { startLevel: levelId } });
    revalidatePath("/[locale]/coach/dashboard", "page");
}
