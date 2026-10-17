// Levels from Pawn to King. Each level is a short lesson and an unrated test of puzzles from a few themes.
// Piece names indicate ranks; each rank introduces its own tactical themes.

// Topics narrower than a Lichess puzzle tag, recognised from the solution line itself.
export type ExerciseFocus = "knightMate" | "queenSacrifice" | "sacrifice" | "capturingDefender" | "rookEndgame" | "promotion";

export interface CurriculumLevel {
    id: string; // e.g. "knight-2"; session key "level:<id>"
    group: "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
    number: number;
    tags: string[];
    startRating: number;
    // Every exercise must show this (e.g. the knight gives the mate).
    only?: ExerciseFocus;
    // The test's share per topic. A topic short of puzzles is made up from the earlier topics first,
    // then from any puzzle with the level's tags.
    mix?: { focus: ExerciseFocus; count: number }[];
}

export const TEST_PUZZLES = 8;
export const TEST_PASS = 6;
export const TEST_STEP = 25;
// After the last fixed level the King level repeats, a little harder each time it is passed.
export const KING_START = 1200;
export const KING_STEP = 100;

// Practice happens on the Levels page itself, with exercises like the test's (see getLevelPractice).
const level = (group: CurriculumLevel["group"], number: number, tags: string[], startRating: number, topic: Pick<CurriculumLevel, "only" | "mix"> = {}): CurriculumLevel =>
    ({ id: `${group}-${number}`, group, number, tags, startRating, ...topic });

export const CURRICULUM: CurriculumLevel[] = [
    level("pawn", 1, ["hangingPiece"], 400),
    level("pawn", 2, ["mateIn1"], 400),
    level("pawn", 3, ["mateIn1", "hangingPiece"], 550),
    level("knight", 1, ["fork"], 600),
    level("knight", 2, ["mateIn1", "mateIn2"], 700, { only: "knightMate" }),
    level("knight", 3, ["fork", "hangingPiece"], 750),
    level("bishop", 1, ["pin"], 750),
    level("bishop", 2, ["skewer"], 800),
    level("bishop", 3, ["mateIn2"], 800),
    level("rook", 1, ["backRankMate"], 850),
    level("rook", 2, ["discoveredAttack"], 900),
    level("rook", 3, ["rookEndgame", "promotion"], 900, { mix: [{ focus: "rookEndgame", count: 5 }, { focus: "promotion", count: 3 }] }),
    level("queen", 1, ["deflection"], 1000),
    level("queen", 2, ["attraction"], 1050),
    level("queen", 3, ["sacrifice", "capturingDefender"], 1100, { mix: [{ focus: "queenSacrifice", count: 4 }, { focus: "capturingDefender", count: 4 }] }),
];

export const KING_LEVEL: CurriculumLevel = level("king", 1, [], KING_START);

export const levelKey = (id: string) => `level:${id}`;
export const findCurriculumLevel = (id: string) => (id === KING_LEVEL.id ? KING_LEVEL : CURRICULUM.find(entry => entry.id === id));

export interface LevelProgress {
    current: CurriculumLevel; // the level to work on now
    currentIndex: number; // index into CURRICULUM, or CURRICULUM.length for King
    passed: Set<string>;
    kingPasses: number;
    kingRating: number; // start rating of the next King test
}

// Levels before the coach's start level count as passed.
export function levelProgress(passedIds: string[], kingPasses: number, startLevel: string | null): LevelProgress {
    const passed = new Set(passedIds);
    const startIndex = startLevel ? Math.max(0, CURRICULUM.findIndex(entry => entry.id === startLevel)) : 0;
    const firstOpen = CURRICULUM.findIndex((entry, index) => index >= startIndex && !passed.has(entry.id));
    const currentIndex = firstOpen === -1 ? CURRICULUM.length : firstOpen;
    for (let index = 0; index < startIndex; index++) passed.add(CURRICULUM[index].id);
    return {
        current: CURRICULUM[currentIndex] ?? KING_LEVEL,
        currentIndex,
        passed,
        kingPasses,
        kingRating: KING_START + kingPasses * KING_STEP,
    };
}

export const testPassed = (correct: number) => correct >= TEST_PASS;
