import { Chess, type Move } from "chess.js";
import { learningMove } from "./puzzleLearning";

export type MoveError = {
    ply: number;
    fen: string;
    played: string;
    expected: string[];
};

export type ExerciseReview = {
    fen: string;
    moves: string[];
    errors: MoveError[];
    success: boolean;
    answer?: { played: string; expected: string };
};

export function isPuzzleMoveCorrect(move: Move, after: Chess, expected: string, finalMove: boolean) {
    return move.from + move.to + (move.promotion ?? "") === expected || move.san === expected
        || (finalMove && after.isCheckmate());
}

// Retain repeated wrong tries: two identical moves are still two mistakes.
export function readMoveErrors(value: unknown): MoveError[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is MoveError => !!item && Number.isInteger(item.ply) && item.ply >= 0
        && typeof item.fen === "string" && typeof item.played === "string"
        && Array.isArray(item.expected) && item.expected.every((move: unknown) => typeof move === "string"));
}

export function puzzleMoveErrors(fen: string, solution: string, input: unknown): MoveError[] {
    if (!Array.isArray(input) || input.length > 1000 || readMoveErrors(input).length !== input.length) throw new Error("Invalid move errors");
    if (!input.length) return [];
    const moves = solution.split(/\s+/).filter(Boolean);
    const game = new Chess(fen);
    const positions = moves.map(move => { const before = game.fen(); learningMove(game, move); return before; });
    return readMoveErrors(input).map(error => {
        if (error.ply % 2 !== 1 || positions[error.ply] !== error.fen) throw new Error("Invalid mistake position");
        const after = new Chess(error.fen);
        const played = learningMove(after, error.played);
        if (isPuzzleMoveCorrect(played, after, moves[error.ply], error.ply === moves.length - 1)) throw new Error("Correct move recorded as a mistake");
        return { ply: error.ply, fen: error.fen, played: played.from + played.to + (played.promotion ?? ""), expected: [moves[error.ply]] };
    });
}

export function validateExerciseReviews(value: unknown) {
    if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid exercise reviews");
    return value.map((review: ExerciseReview) => {
        if (!review || typeof review.fen !== "string" || typeof review.success !== "boolean" || !Array.isArray(review.moves)
            || review.moves.length > 200 || !review.moves.every(move => typeof move === "string")
            || !Array.isArray(review.errors) || review.errors.length > 1000 || readMoveErrors(review.errors).length !== review.errors.length) throw new Error("Invalid exercise review");
        const game = new Chess(review.fen);
        const positions = review.moves.map(move => { const before = game.fen(); learningMove(game, move); return before; });
        const errors = review.errors.map(error => {
            if (positions[error.ply] !== error.fen) throw new Error("Invalid exercise mistake position");
            const after = new Chess(error.fen);
            const move = learningMove(after, error.played);
            if (isPuzzleMoveCorrect(move, after, review.moves[error.ply], error.ply === review.moves.length - 1)) throw new Error("Correct exercise move recorded as a mistake");
            return { ply: error.ply, fen: error.fen, played: move.from + move.to + (move.promotion ?? ""), expected: [review.moves[error.ply]] };
        });
        if (review.success && errors.length) throw new Error("Successful exercise contains mistakes");
        const answer = review.answer;
        if (answer && (typeof answer.played !== "string" || answer.played.length > 200 || typeof answer.expected !== "string" || answer.expected.length > 200)) throw new Error("Invalid notation answer");
        return { fen: review.fen, moves: review.moves, success: review.success, errors, ...(answer ? { answer: { played: answer.played, expected: answer.expected } } : {}) };
    });
}

export function describeMove(fen: string, uci: string) {
    try {
        const game = new Chess(fen);
        const number = game.moveNumber();
        const side = game.turn();
        const move = learningMove(game, uci);
        return { label: `${number}${side === "w" ? "." : "…"} ${move.san}`, san: move.san, fen: game.fen(), from: move.from, to: move.to };
    } catch { return null; }
}
