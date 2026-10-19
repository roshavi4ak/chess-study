import { Chess } from "chess.js";
import { learningMove } from "./puzzleLearning";

export const MICRO_LESSONS = {
    safeCapture: { fen: "7k/8/8/n7/8/8/8/R6K w - - 0 1", move: "a1a5", targets: ["a5"], challenge: "7k/8/1b6/8/8/8/8/1R5K w - - 0 1", answer: "b1b6" },
    checkmate: { fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", move: "f7g7", targets: ["h8"], challenge: "7k/4Q3/6K1/8/8/8/8/8 w - - 0 1", answer: "e7g7" },
    fork: { fen: "3q3k/8/8/4N3/8/8/8/7K w - - 0 1", move: "e5f7", targets: ["h8", "d8"], challenge: "2q3k1/8/2N5/8/8/8/8/7K w - - 0 1", answer: "c6e7" },
    pin: { fen: "4k3/3n4/8/8/2B5/8/8/7K w - - 0 1", move: "c4b5", targets: ["d7", "e8"], challenge: "4k3/3n4/8/8/8/8/8/5B1K w - - 0 1", answer: "f1b5" },
    defend: { fen: "r6k/8/8/8/8/8/8/R6K w - - 0 1", move: "a1b1", targets: ["a8"], challenge: "2r4k/8/8/8/8/8/8/2R4K w - - 0 1", answer: "c1d1" },
} as const;
export type MicroLessonId = keyof typeof MICRO_LESSONS;

export function lessonForLevel(levelId: string): MicroLessonId | null {
    return ({ "pawn-1": "safeCapture", "pawn-2": "checkmate", "pawn-3": "defend", "knight-1": "fork", "knight-2": "checkmate", "knight-3": "fork", "bishop-1": "pin" } as Record<string, MicroLessonId>)[levelId] ?? null;
}

export function lessonAnswer(id: MicroLessonId, uci: string) {
    const lesson = MICRO_LESSONS[id];
    try {
        const game = new Chess(lesson.challenge);
        const side = game.turn();
        const played = learningMove(game, uci);
        if (id === "checkmate") return game.isCheckmate();
        if (id === "defend") return played.from === lesson.answer.slice(0, 2) && !game.isAttacked(played.to, side === "w" ? "b" : "w");
        return uci === lesson.answer;
    } catch { return false; }
}
