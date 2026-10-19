import { prisma } from "./db";
import { selectPuzzleReviews } from "./puzzleReview";
import { isSkillTag } from "./dailyMission";

export async function loadPuzzleReviews(userId: string, now = new Date()) {
    const failures = await prisma.puzzleAttempt.findMany({ where: { userId, success: false }, distinct: ["puzzleId"], select: { puzzleId: true } });
    if (!failures.length) return { items: [], target: 0, done: 0 };
    const history = await prisma.puzzleAttempt.findMany({ where: { userId, puzzleId: { in: failures.map(item => item.puzzleId) } }, select: { puzzleId: true, success: true, createdAt: true } });
    const selected = selectPuzzleReviews(history, now);
    const rows = await prisma.puzzle.findMany({ where: { id: { in: selected.filter(item => !item.done).map(item => item.puzzleId) } }, select: { id: true, name: true, fen: true, solution: true, hints: true, tags: true, rating: true } });
    const items = selected.flatMap(item => {
        const puzzle = rows.find(row => row.id === item.puzzleId);
        return puzzle ? [{ ...puzzle, hints: Array.isArray(puzzle.hints) ? puzzle.hints.map(hint => typeof hint === "string" ? hint : "") : [], fresh: false }] : [];
    });
    return { items, target: selected.length, done: selected.filter(item => item.done).length };
}

export async function loadReviewTransfer(userId: string, reviews: Awaited<ReturnType<typeof loadPuzzleReviews>>["items"]) {
    const fresh: (Awaited<ReturnType<typeof loadPuzzleReviews>>["items"][number] & { afterPuzzleId: string })[] = [];
    for (const review of reviews.slice(0, 2)) {
        const tag = review.tags.find(isSkillTag);
        if (!tag) continue;
        const [puzzle] = await prisma.puzzle.findMany({ where: { id: { notIn: [...reviews.map(item => item.id), ...fresh.map(item => item.id)] }, tags: { has: tag }, rating: { gte: Math.max(0, review.rating - 150), lte: review.rating + 150 }, attempts: { none: { userId } } }, select: { id: true, name: true, fen: true, solution: true, hints: true, tags: true, rating: true }, take: 1, orderBy: { rating: "asc" } });
        if (puzzle) fresh.push({ ...puzzle, hints: Array.isArray(puzzle.hints) ? puzzle.hints.map(hint => typeof hint === "string" ? hint : "") : [], fresh: true, afterPuzzleId: review.id });
    }
    return fresh;
}
