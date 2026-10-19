import { Chess, type Color } from "chess.js";
import { learningMove } from "./puzzleLearning";

export const DEFENSE_LEVELS = [
    { level: 1, min: 0, max: 0, replies: 1 },
    { level: 2, min: 400, max: 900, replies: 1 },
    { level: 3, min: 900, max: 1100, replies: 1 },
    { level: 4, min: 1100, max: 1300, replies: 1 },
    { level: 5, min: 1300, max: 1500, replies: 2 },
    { level: 6, min: 1500, max: 1750, replies: 2 },
    { level: 7, min: 1750, max: 1950, replies: 2 },
    { level: 8, min: 1950, max: 2100, replies: 3 },
    { level: 9, min: 2100, max: 2250, replies: 3 },
    { level: 10, min: 2250, max: 2600, replies: 3 },
] as const;
export interface DefensePuzzleCandidate { id: string; name: string; fen: string; solution: string; rating: number; tags: string[] }
export interface DefensePuzzle extends DefensePuzzleCandidate { setup: string; moves: string[]; side: Color }

// Only actual defensive-move puzzles within the selected band. Validate the entire authored line.
export function prepareDefensePuzzle(row: DefensePuzzleCandidate, level: number): DefensePuzzle | null {
    const band = DEFENSE_LEVELS.find(item => item.level === level);
    if (!band || level === 1 || row.rating < band.min || row.rating >= band.max || !row.tags.includes("defensiveMove")) return null;
    const [setup, ...moves] = row.solution.trim().split(/\s+/);
    if (Math.ceil(moves.length / 2) < band.replies) return null;
    try {
        const game = new Chess(row.fen);
        if (game.isGameOver()) return null;
        const opening = learningMove(game, setup);
        const side = game.turn();
        if (game.isGameOver()) return null;
        const normalized = moves.map(move => {
            if (game.isGameOver()) throw new Error("The line continues after the game ends");
            const played = learningMove(game, move);
            return played.from + played.to + (played.promotion ?? "");
        });
        // Finish on the student's move; the imported line can include a final opponent recapture.
        const studentMoves = normalized.length % 2 ? normalized : normalized.slice(0, -1);
        return { ...row, setup: opening.from + opening.to + (opening.promotion ?? ""), moves: studentMoves, side };
    } catch { return null; }
}

export interface TrainingEvaluation { score: { type: "cp" | "mate"; value: number }; pv: string[] }
// Both evaluations are after a student move, so lower scores for the opponent are better.
export function equivalentDefense(reference: TrainingEvaluation, candidate: TrainingEvaluation) {
    const score = (item: TrainingEvaluation) => item.score.type === "cp" ? item.score.value : Math.sign(item.score.value) * (100000 - Math.abs(item.score.value));
    const expected = score(reference), actual = score(candidate);
    if (expected < -90000 && actual < -90000) return true;
    if (actual > 90000 && expected <= 90000) return false;
    return actual <= expected + 60;
}
