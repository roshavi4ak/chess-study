import { Chess, type Color } from "chess.js";
import starts from "./endgameStarts.json";

export const ENDGAMES = [
    { id: "queenMate", goal: "mate", fen: "7k/8/8/8/4Q1K1/8/8/8 w - - 0 1", demoFen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", demo: ["f7g7"] },
    { id: "rookMate", goal: "mate", fen: "7k/8/8/5K2/8/8/8/R7 w - - 0 1", demoFen: "7k/8/6K1/8/8/8/8/R7 w - - 0 1", demo: ["a1a8"] },
    { id: "promotion", goal: "promotion", fen: "8/7k/5K2/5P2/8/8/8/8 w - - 0 1", demoFen: "7k/5P2/5K2/8/8/8/8/8 w - - 0 1", demo: ["f7f8q"] },
    { id: "opposition", goal: "promotion", fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", demoFen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", demo: ["e6f6", "e8f8", "e5e6", "f8e8", "e6e7", "e8d7", "f6f7", "d7d6", "e7e8q"] },
    { id: "holdDraw", goal: "draw", fen: "8/8/8/8/6k1/7p/8/7K w - - 0 1", demoFen: "8/8/8/8/6k1/8/7p/7K b - - 0 1", demo: ["g4g3"] },
    { id: "bishopPairMate", goal: "mate", fen: "7k/8/5K1B/5B2/8/8/8/8 w - - 0 1", demoFen: "7k/5K2/7B/5B2/8/8/8/8 w - - 0 1", demo: ["h6g7"] },
    { id: "bishopKnightMate", goal: "mate", fen: "7k/8/5K1B/5N2/8/8/8/8 w - - 0 1", demoFen: "7k/5K2/5N1B/8/8/8/8/8 w - - 0 1", demo: ["h6g7"] },
] as const;
export type Endgame = typeof ENDGAMES[number];
export type EndgameId = Endgame["id"];

function transformFen(fen: string, symmetry: number) {
    const game = new Chess(fen), transformed = new Chess(); transformed.clear();
    for (const row of game.board()) for (const piece of row) {
        if (!piece) continue;
        let file = piece.square.charCodeAt(0) - 97, rank = Number(piece.square[1]) - 1;
        if (symmetry >= 4) file = 7 - file;
        for (let rotation = 0; rotation < symmetry % 4; rotation++) [file, rank] = [7 - rank, file];
        transformed.put({ type: piece.type, color: piece.color }, `${"abcdefgh"[file]}${rank + 1}` as Parameters<Chess["put"]>[1]);
    }
    return transformed.fen();
}

// Randomize complete, tablebase-verified arrangements, plus legal board symmetries.
// Pawn positions may only reflect across files: rotating would change promotion direction.
export function randomEndgameFen(challenge: Endgame, previous?: string, random = Math.random) {
    const pool = starts.positions[challenge.id];
    const pawnEnding = challenge.goal !== "mate";
    for (let attempt = 0; attempt < 12; attempt++) {
        const seed = pool[Math.floor(random() * pool.length) % pool.length].fen;
        const fen = transformFen(seed, pawnEnding ? (random() < 0.5 ? 0 : 4) : Math.floor(random() * 8) % 8);
        if (fen !== previous) return fen;
    }
    // Even a fixed/random source cannot make "new position" repeat the previous start.
    return pool.map(item => item.fen).find(fen => fen !== previous)!;
}

export function endgameFen(challenge: Endgame, mirrored: boolean) {
    if (!mirrored) return challenge.fen;
    const [board, ...rest] = challenge.fen.split(" ");
    return [board.split("/").map(row => row.split("").reverse().join("")).join("/"), ...rest].join(" ");
}

export function endgameOutcome(game: Chess, goal: Endgame["goal"], side: Color): "won" | "stalemate" | "draw" | "lost" | null {
    const last = game.history({ verbose: true }).at(-1);
    if (goal === "promotion" && last?.color === side && last.promotion) return "won";
    if (game.isCheckmate()) return game.turn() !== side && goal !== "draw" ? "won" : "lost";
    if (game.isDraw()) return goal === "draw" ? "won" : game.isStalemate() ? "stalemate" : "draw";
    return null;
}
