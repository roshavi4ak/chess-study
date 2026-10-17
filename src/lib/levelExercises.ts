import { Chess, type Square, type PieceSymbol } from "chess.js";
import { TEST_PUZZLES, type CurriculumLevel, type ExerciseFocus } from "./curriculum";

export const EXERCISE_THEMES = ["hangingPiece", "mateIn1", "mateIn2", "fork", "pin", "skewer", "backRankMate", "discoveredAttack", "endgame", "deflection", "attraction", "tactics",
    "knightMate", "rookEndgame", "promotion", "queenSacrifice", "sacrifice", "capturingDefender"] as const;
export type ExerciseTheme = typeof EXERCISE_THEMES[number];

export interface LevelExercise {
    id: string;
    fen: string; // Starts with the student's turn; no hidden setup move.
    moves: string[]; // Student move, opponent reply, student move, ...
    theme: ExerciseTheme;
    setupMove?: { from: string; to: string };
}

function hangingExercise(id: string, piece: PieceSymbol, from: Square, to: Square, target: PieceSymbol): LevelExercise {
    const game = new Chess();
    game.clear();
    game.put({ type: "k", color: "w" }, "h1");
    game.put({ type: "k", color: "b" }, "h8");
    game.put({ type: piece, color: "w" }, from);
    game.put({ type: target, color: "b" }, to);
    return { id, fen: game.fen(), moves: [from + to], theme: "hangingPiece" };
}

// Pawn is the entry rank, not a restriction to pawn moves. Each question is one
// safe capture of an undefended piece, with no tactical setup or lengthy line.
const BEGINNER_HANGING: LevelExercise[] = [
    hangingExercise("hanging-rook-a", "r", "a1", "a5", "n"),
    hangingExercise("hanging-bishop-a", "b", "c1", "f4", "r"),
    hangingExercise("hanging-knight-a", "n", "b1", "c3", "p"),
    hangingExercise("hanging-queen", "q", "d1", "d4", "b"),
    hangingExercise("hanging-pawn", "p", "b2", "c3", "n"),
    hangingExercise("hanging-rook-b", "r", "b1", "b6", "b"),
    hangingExercise("hanging-bishop-b", "b", "b1", "e4", "p"),
    hangingExercise("hanging-knight-b", "n", "d2", "e4", "r"),
];

export const beginnerExercises = (levelId: string): LevelExercise[] | null => levelId === "pawn-1" ? BEGINNER_HANGING : null;

const SQUARES = "abcdefgh".split("").flatMap(fileName => "12345678".split("").map(rankName => `${fileName}${rankName}` as Square));
const ATTACKERS: PieceSymbol[] = ["q", "r", "b", "n", "p"];
const TARGETS: PieceSymbol[] = ["q", "r", "b", "n", "p"];

// Fresh practice positions in the style of the Pawn 1 test: one white piece, one undefended black piece,
// and a single legal, safe capture. Kings stay in the corners and never take part.
export function randomHangingExercises(count: number, random: () => number = Math.random): LevelExercise[] {
    const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
    const exercises: LevelExercise[] = [];
    const seen = new Set<string>();
    for (let tries = 0; exercises.length < count && tries < count * 200; tries++) {
        const piece = pick(ATTACKERS);
        const from = pick(SQUARES);
        if (from === "h1" || from === "h8" || (piece === "p" && !/[2-6]$/.test(from))) continue;
        const game = new Chess();
        game.clear();
        game.put({ type: "k", color: "w" }, "h1");
        game.put({ type: "k", color: "b" }, "h8");
        if (!game.put({ type: piece, color: "w" }, from) || game.isAttacked("h8", "w")) continue;
        // Any square the piece reaches (a pawn captures diagonally, so try both diagonals for it).
        const reach = piece === "p"
            ? [-1, 1].map(step => `${String.fromCharCode(from.charCodeAt(0) + step)}${Number(from[1]) + 1}`).filter(square => SQUARES.includes(square as Square)) as Square[]
            : game.moves({ square: from, verbose: true }).map(move => move.to as Square);
        const to = reach.length ? pick(reach) : null;
        const target = pick(TARGETS);
        if (!to || game.get(to) || (target === "p" && /[18]$/.test(to))) continue;
        game.put({ type: target, color: "b" }, to);
        const fen = game.fen();
        if (seen.has(fen) || game.inCheck() || game.isAttacked("h8", "w")) continue;
        // Exactly one capture on the board, so the answer is never ambiguous (e.g. the king taking instead).
        const captures = game.moves({ verbose: true }).filter(move => move.captured);
        const capture = captures.length === 1 ? captures.find(move => move.from === from && move.to === to) : undefined;
        if (!capture) continue;
        game.move(capture);
        // Safe: the black king cannot take back.
        if (game.isAttacked(to, "b")) continue;
        seen.add(fen);
        exercises.push({ id: `hanging-practice-${exercises.length}-${from}${to}`, fen, moves: [from + to], theme: "hangingPiece" });
    }
    return exercises;
}

export interface LevelPuzzleCandidate {
    id: string;
    fen: string;
    solution: string;
    rating: number;
    tags: string[];
}

// A level's test stays close to its practice difficulty, rather than climbing a ladder.
export const levelRatingRange = (start: number) => {
    // The first ranks stay especially narrow. Later motifs need a little more
    // room to provide eight distinct questions without changing topic.
    const radius = start <= 600 ? 100 : 150;
    return { min: Math.max(0, start - radius), max: start + radius };
};

export function selectLevelExercises(pool: LevelPuzzleCandidate[], level: CurriculumLevel, start: number): LevelExercise[] {
    const range = levelRatingRange(start);
    const candidates: { exercise: LevelExercise; focus: Set<ExerciseFocus> }[] = [];
    const seen = new Set<string>();
    for (const puzzle of pool) {
        if (seen.has(puzzle.id) || puzzle.rating < range.min || puzzle.rating > range.max) continue;
        if (level.tags.length && !level.tags.some(tag => puzzle.tags.includes(tag))) continue;
        try {
            const game = new Chess(puzzle.fen);
            const line = puzzle.solution.split(" ").filter(Boolean);
            const setup = applyExerciseMove(game, line[0]);
            const fen = game.fen();
            const moves = line.slice(1);
            const limit = start <= 750 ? 3 : start <= 1100 ? 5 : 9;
            if (!moves.length || moves.length % 2 !== 1 || moves.length > limit) continue;
            let lastPiece: PieceSymbol | null = null;
            let queenTaken = false;
            moves.forEach((move, index) => {
                const played = applyExerciseMove(game, move);
                if (index % 2 === 0) lastPiece = played.piece;
                else if (played.captured === "q") queenTaken = true;
            });
            const focus = focusOf(puzzle.tags, lastPiece, game.isCheckmate(), queenTaken);
            if (level.only && !focus.has(level.only)) continue;
            const theme = level.only ?? (level.tags.length ? level.tags : EXERCISE_THEMES)
                .find(tag => puzzle.tags.includes(tag) && EXERCISE_THEMES.includes(tag as ExerciseTheme)) as ExerciseTheme | undefined;
            candidates.push({ exercise: { id: puzzle.id, fen, moves, theme: theme ?? "tactics", setupMove: { from: setup.from, to: setup.to } }, focus });
            seen.add(puzzle.id);
            if (!level.mix && candidates.length === TEST_PUZZLES) break;
        } catch {
            // Bad imports must not produce an unusable or misleading test board.
        }
    }
    const chosen = level.mix ? mixExercises(candidates, level.mix) : candidates.slice(0, TEST_PUZZLES).map(candidate => candidate.exercise);
    // An incomplete test cannot fairly use the fixed six-of-eight pass threshold.
    return chosen.length === TEST_PUZZLES ? chosen : [];
}

function focusOf(tags: string[], lastPiece: PieceSymbol | null, checkmate: boolean, queenTaken: boolean) {
    const focus = new Set<ExerciseFocus>();
    if (lastPiece === "n" && checkmate) focus.add("knightMate");
    if (tags.includes("sacrifice")) {
        focus.add("sacrifice");
        // Only the student's queen can be taken by the opponent's replies.
        if (queenTaken) focus.add("queenSacrifice");
    }
    for (const tag of ["capturingDefender", "rookEndgame", "promotion"] as const) if (tags.includes(tag)) focus.add(tag);
    return focus;
}

// Fills each topic's share, then tops up from the earlier topics, then from anything left. Keeps the pool's random order.
function mixExercises(candidates: { exercise: LevelExercise; focus: Set<ExerciseFocus> }[], mix: NonNullable<CurriculumLevel["mix"]>): LevelExercise[] {
    const picked = new Map<number, ExerciseTheme>();
    const take = (focus: ExerciseFocus | null, count: number) => {
        candidates.forEach((candidate, index) => {
            if (count <= 0 || picked.size >= TEST_PUZZLES || picked.has(index) || (focus && !candidate.focus.has(focus))) return;
            picked.set(index, focus ?? candidate.exercise.theme);
            count -= 1;
        });
    };
    for (const { focus, count } of mix) take(focus, count);
    for (const { focus } of mix) take(focus, TEST_PUZZLES);
    take(null, TEST_PUZZLES);
    return [...picked].sort(([a], [b]) => a - b).map(([index, theme]) => ({ ...candidates[index].exercise, theme }));
}

export function applyExerciseMove(game: Chess, uci: string) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci ?? "")) throw new Error("Invalid exercise move");
    return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

export interface ExerciseAttempt {
    fen: string;
    index: number;
    status: "playing" | "wrong" | "step" | "complete" | "solution" | "reviewed";
    mistakes: number;
    assisted: boolean;
    lastMove: { from: string; to: string } | null;
    played: string[];
}

export const startExercise = (exercise: LevelExercise): ExerciseAttempt => ({ fen: exercise.fen, index: 0, status: "playing", mistakes: 0, assisted: false, lastMove: exercise.setupMove ?? null, played: [] });
export const exerciseCredit = (attempt: ExerciseAttempt) => attempt.status === "complete" && attempt.mistakes === 0 && !attempt.assisted;
export const retryExercise = (exercise: LevelExercise, attempt: ExerciseAttempt): ExerciseAttempt => ({ ...startExercise(exercise), mistakes: attempt.mistakes, assisted: attempt.assisted });
export const showExerciseSolution = (exercise: LevelExercise, attempt: ExerciseAttempt): ExerciseAttempt => ({ ...retryExercise(exercise, attempt), assisted: true, status: "solution" });

export function attemptExerciseMove(exercise: LevelExercise, attempt: ExerciseAttempt, input: { from: string; to: string; promotion?: string }): ExerciseAttempt {
    if (attempt.status !== "playing") return attempt;
    const game = new Chess(attempt.fen);
    try {
        const move = game.move({ ...input, promotion: input.promotion ?? "q" });
        const uci = move.from + move.to + (move.promotion ?? "");
        const mateGoal = ["mateIn1", "mateIn2", "backRankMate", "knightMate", "tactics"].includes(exercise.theme);
        const alternateMate = mateGoal && attempt.index === exercise.moves.length - 1 && game.isCheckmate();
        if (uci !== exercise.moves[attempt.index] && !alternateMate) throw new Error("Try again");
        const index = attempt.index + 1;
        return { ...attempt, fen: game.fen(), index, status: index === exercise.moves.length ? "complete" : "step", lastMove: { from: move.from, to: move.to }, played: [...attempt.played, move.san] };
    } catch {
        return { ...attempt, status: "wrong", mistakes: attempt.mistakes + 1, lastMove: { from: input.from, to: input.to } };
    }
}

export function nextExerciseMove(exercise: LevelExercise, attempt: ExerciseAttempt): ExerciseAttempt {
    if (attempt.status !== "step" && attempt.status !== "solution") return attempt;
    const game = new Chess(attempt.fen);
    const move = applyExerciseMove(game, exercise.moves[attempt.index]);
    const index = attempt.index + 1;
    const status = attempt.status === "solution"
        ? (index === exercise.moves.length ? "reviewed" : "solution")
        : (index === exercise.moves.length ? "complete" : "playing");
    return { ...attempt, fen: game.fen(), index, status, lastMove: { from: move.from, to: move.to }, played: [...attempt.played, move.san] };
}
