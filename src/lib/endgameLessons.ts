import { Chess, type Square } from "chess.js";
import type { EndgameId } from "./endgameTraining";
import { learningMove } from "./puzzleLearning";

export interface EndgameLessonStep { id: string; fen: string; moves: readonly string[]; focus: readonly Square[] }
const step = (id: string, fen: string, moves: string[], focus: Square[] = []): EndgameLessonStep => ({ id, fen, moves, focus });
const after = (fen: string, moves: string[]) => { const game = new Chess(fen); moves.forEach(move => learningMove(game, move)); return game.fen(); };
const opposition = "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1";
// Bb3 protects f7 before the knight starts its route. A bishop on d3 would
// leave Nf7 hanging in the king-wall example after Kd6 (…Kxf7 draws).
const knightRoute = "5k2/5N2/2K5/8/8/1B6/8/8 w - - 0 1";

// Original, short teaching examples. Separate snapshots illustrate techniques rather than
// pretending one remembered sequence will work against every defending king move.
export const ENDGAME_LESSONS: Record<EndgameId, readonly EndgameLessonStep[]> = {
    queenMate: [
        step("fence", "8/8/5k2/8/8/2KQ4/8/8 w - - 0 1", ["d3e4", "f6g7"], ["e5", "e6", "e7", "e8", "f4", "g4", "h4"]),
        step("king", "8/7k/8/8/5K2/8/8/4Q3 w - - 0 1", ["f4g5", "h7h8"], ["g5", "g6", "h6"]),
        step("stalemate", "7k/4Q3/6K1/8/8/8/8/8 w - - 0 1", ["e7f7"], ["g8", "g7", "h7"]),
        step("mate", "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", ["f7g7"], ["g7", "g8", "h7"]),
    ],
    rookMate: [
        step("fence", "8/8/5k2/8/8/2K5/8/R7 w - - 0 1", ["a1e1", "f6f7"], ["e2", "e3", "e4", "e5", "e6", "e7", "e8"]),
        step("king", "8/8/5k2/8/8/2K5/8/4R3 w - - 0 1", ["c3d4", "f6f7"], ["d4", "e5", "e4"]),
        step("wait", "7k/R7/5K2/8/8/8/8/8 w - - 0 1", ["a7b7", "h8g8"], ["g8", "g7", "h7"]),
        step("mate", "7k/8/6K1/8/8/8/8/R7 w - - 0 1", ["a1a8"], ["g7", "h7"]),
    ],
    promotion: [
        step("lead", "8/k7/8/8/5K2/4P3/8/8 w - - 0 1", ["f4e5", "a7b7"], ["d5", "e5", "f5"]),
        step("protect", "8/k7/8/4K3/8/4P3/8/8 w - - 0 1", ["e3e4", "a7b7"], ["e4", "e5"]),
        step("rush", "8/8/4k3/8/4P3/8/5K2/8 w - - 0 1", ["e4e5", "e6e5"], ["e5", "f2"]),
        step("promote", "7k/5P2/5K2/8/8/8/8/8 w - - 0 1", ["f7f8q"], ["f8"]),
    ],
    opposition: [
        step("face", "4k3/8/4K3/4P3/8/8/8/8 b - - 0 1", ["e8d8", "e6f7"], ["e7", "d7", "f7"]),
        step("side", opposition, ["e6f6", "e8f8", "e5e6"], ["f6", "e6", "e7"]),
        step("escort", after(opposition, ["e6f6", "e8f8", "e5e6", "f8e8"]), ["e6e7", "e8d7", "f6f7"], ["e7", "f7", "e8"]),
        step("promote", after(opposition, ["e6f6", "e8f8", "e5e6", "f8e8", "e6e7", "e8d7", "f6f7"]), ["d7d6", "e7e8q"], ["e8", "f7"]),
    ],
    holdDraw: [
        step("corner", "8/8/8/8/7k/7p/5K2/8 w - - 0 1", ["f2g1", "h4g4", "g1h1"], ["h1", "g1"]),
        step("stalemate", "8/8/8/8/8/6kp/8/7K b - - 0 1", ["h3h2"], ["g1", "g2", "h2"]),
        step("capture", "8/8/8/8/6k1/8/7p/7K w - - 0 1", ["h1h2"], ["h2", "g4"]),
    ],
    bishopPairMate: [
        step("diagonals", "8/8/5k2/8/8/2KBB3/8/8 w - - 0 1", ["e3f4", "f6e6"], ["e4", "f5", "g6", "g5", "h6"]),
        step("king", "8/6k1/8/8/3K4/3BB3/8/8 w - - 0 1", ["d4e5", "g7g8"], ["e5", "f6", "e6", "d6"]),
        step("net", "7k/5K2/7B/5B2/8/8/8/8 w - - 0 1", ["h6g7"], ["g8", "g7", "h7"]),
    ],
    bishopKnightMate: [
        step("corner", knightRoute, [], ["a8", "h1"]),
        step("wall", "4k3/5N2/2K5/8/8/1B6/8/8 w - - 0 1", ["c6d6", "e8f8"], ["c7", "d7", "e7", "b3", "f7"]),
        step("routeA", knightRoute, ["f7e5", "f8e8", "e5d7", "e8d8"], ["f7", "e5", "d7"]),
        step("routeB", after(knightRoute, ["f7e5", "f8e8", "e5d7", "e8d8"]), ["d7c5", "d8c8", "c5b7", "c8b8"], ["d7", "c5", "b7", "a8"]),
        step("mate", "7k/5K2/5N1B/8/8/8/8/8 w - - 0 1", ["h6g7"], ["g8", "h7", "g7", "h8"]),
    ],
};
