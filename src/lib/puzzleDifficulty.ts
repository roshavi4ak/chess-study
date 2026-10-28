export interface PuzzleDifficulty {
    minOffset: number;
    maxOffset: number;
    preferredOffset: number;
    allowStudentChoice: boolean;
}

export const DEFAULT_PUZZLE_DIFFICULTY: Readonly<PuzzleDifficulty> = {
    minOffset: 0, maxOffset: 300, preferredOffset: 100, allowStudentChoice: true,
};
export const MIN_DIFFICULTY_OFFSET = -600;
export const MAX_DIFFICULTY_OFFSET = 1000;

export function isPuzzleDifficulty(value: unknown): value is PuzzleDifficulty {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const settings = value as PuzzleDifficulty;
    return [settings.minOffset, settings.maxOffset, settings.preferredOffset].every(Number.isInteger)
        && settings.minOffset >= MIN_DIFFICULTY_OFFSET && settings.maxOffset <= MAX_DIFFICULTY_OFFSET
        && settings.minOffset <= settings.preferredOffset && settings.preferredOffset <= settings.maxOffset
        && typeof settings.allowStudentChoice === "boolean";
}

export function puzzleDifficulty(value: unknown): PuzzleDifficulty {
    return isPuzzleDifficulty(value) ? {
        minOffset: value.minOffset, maxOffset: value.maxOffset,
        preferredOffset: value.preferredOffset, allowStudentChoice: value.allowStudentChoice,
    } : { ...DEFAULT_PUZZLE_DIFFICULTY };
}

export function puzzleRatingRange(rating: number | null | undefined, stored: unknown) {
    const settings = puzzleDifficulty(stored);
    const studentRating = typeof rating === "number" && Number.isFinite(rating) ? Math.round(rating) : 1500;
    const min = Math.max(0, studentRating + settings.minOffset);
    const max = Math.max(min, studentRating + settings.maxOffset);
    const target = Math.min(max, Math.max(min, studentRating + settings.preferredOffset));
    return { ...settings, studentRating, min, max, target };
}

export type PuzzleDifficultyView = ReturnType<typeof puzzleRatingRange> & { canEditLimits: boolean };
