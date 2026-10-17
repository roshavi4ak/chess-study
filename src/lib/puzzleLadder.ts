export interface LadderPuzzle {
    id: string;
    fen: string;
    solution: string;
    rating: number;
}

// Picks `count` different puzzles whose ratings climb from `start` by `step`, each the closest unused one to its target.
export function pickLadder<T extends LadderPuzzle>(pool: T[], start: number, step: number, count: number): T[] {
    const unused = [...pool];
    const ladder: T[] = [];
    for (let index = 0; index < count && unused.length; index++) {
        const target = start + index * step;
        let best = 0;
        for (let candidate = 1; candidate < unused.length; candidate++) {
            if (Math.abs(unused[candidate].rating - target) < Math.abs(unused[best].rating - target)) best = candidate;
        }
        ladder.push(unused.splice(best, 1)[0]);
    }
    return ladder;
}

// Streaks start comfortably below the child's puzzle rating, so the first puzzles feel easy.
export const STREAK_START_OFFSET = -300;
export const STREAK_STEP = 50;
export const MIN_PUZZLE_RATING = 400;

export function streakStart(puzzleRating: number | null | undefined) {
    return Math.max(MIN_PUZZLE_RATING, (puzzleRating ?? 1200) + STREAK_START_OFFSET);
}
