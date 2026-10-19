import { Chess, type PieceSymbol, type Square } from "chess.js";
import { captureThreats, moveUci, moveWarning } from "./chessTeaching";
import { learningMove } from "./puzzleLearning";

export interface DefensePosition { id: string; theme: "rook" | "bishop" | "knight" | "pawn" | "queen"; fen: string; setup: string; target: Square; safe: string; tempting: string }

function position(id: string, theme: DefensePosition["theme"], attacker: PieceSymbol, start: Square, setup: string, piece: PieceSymbol, target: Square, safe: string, tempting: string, whiteKing: Square = "h1", blackKing: Square = "h8"): DefensePosition {
    const game = new Chess(); game.clear();
    game.put({ type: "k", color: "w" }, whiteKing); game.put({ type: "k", color: "b" }, blackKing);
    game.put({ type: attacker, color: "b" }, start); game.put({ type: piece, color: "w" }, target);
    const fields = game.fen().split(" "); fields[1] = "b";
    return { id, theme, fen: fields.join(" "), setup, target, safe, tempting };
}

// Twenty authored situations. The answer checker accepts other sound defenses too.
export const DEFENSE_POSITIONS: DefensePosition[] = [
    position("rook-1", "rook", "r", "a8", "a8b8", "r", "b2", "b2c2", "h1g1"),
    position("rook-2", "rook", "r", "h8", "h8g8", "q", "g3", "g3f3", "a1b1", "a1", "a8"),
    position("rook-3", "rook", "r", "d8", "d8c8", "b", "c3", "c3d4", "h1g1", "h1", "h7"),
    position("rook-4", "rook", "r", "e8", "e8d8", "n", "d4", "d4f5", "h1g1"),
    position("bishop-1", "bishop", "b", "f8", "f8c5", "q", "f2", "f2e2", "h1h2"),
    position("bishop-2", "bishop", "b", "c8", "c8g4", "r", "d1", "d1d2", "h1g1"),
    position("bishop-3", "bishop", "b", "g7", "g7e5", "n", "b2", "b2d3", "h1g1"),
    position("bishop-4", "bishop", "b", "a6", "a6b5", "r", "e2", "e2e3", "h1g1"),
    position("knight-1", "knight", "n", "g8", "g8f6", "q", "e4", "e4d4", "h1g1"),
    position("knight-2", "knight", "n", "b8", "b8c6", "r", "d4", "d4d3", "h1g1"),
    position("knight-3", "knight", "n", "d7", "d7e5", "b", "c4", "c4b3", "h1g1"),
    position("knight-4", "knight", "n", "f8", "f8g6", "r", "h4", "h4h3", "a1b1", "a1", "a8"),
    position("pawn-1", "pawn", "p", "d7", "d7d5", "n", "c4", "c4b2", "h1g1"),
    position("pawn-2", "pawn", "p", "g7", "g7g5", "r", "f4", "f4e4", "h1g1"),
    position("pawn-3", "pawn", "p", "b6", "b6b5", "b", "c4", "c4d3", "h1g1"),
    position("pawn-4", "pawn", "p", "e6", "e6e5", "q", "d4", "d4c3", "h1g1"),
    position("queen-1", "queen", "q", "d8", "d8a5", "n", "b4", "b4c2", "h1g1"),
    position("queen-2", "queen", "q", "e8", "e8e5", "r", "b5", "b5b4", "h1g1"),
    position("queen-3", "queen", "q", "a8", "a8d5", "b", "g2", "g2f1", "a1b1", "a1"),
    position("queen-4", "queen", "q", "h8", "h8f6", "q", "c3", "c3c2", "h1g1", "h1", "a8"),
];

export function defenseStart(position: DefensePosition) {
    const game = new Chess(position.fen);
    const setup = learningMove(game, position.setup);
    return { fen: game.fen(), from: setup.from, to: setup.to, san: setup.san };
}

export function defenseAnswer(position: DefensePosition, uci: string) {
    const fen = defenseStart(position).fen;
    const game = new Chess(fen);
    try {
        const move = learningMove(game, uci);
        if (game.isCheckmate()) return { correct: true, fen: game.fen(), reply: null };
        const warning = moveWarning(fen, moveUci(move));
        const targetSquare = move.from === position.target ? move.to : position.target;
        const threat = captureThreats(game.fen(), "w").find(item => item.square === targetSquare);
        const correct = !game.isStalemate() && !warning && !threat;
        return { correct, fen: game.fen(), reply: warning?.reply ?? threat?.reply ?? null };
    } catch { return null; }
}

export function defenseRound(round: number) {
    // One of each attacker per short round, with new authored examples next time.
    return [0, 4, 8, 12, 16].map((start, index) => DEFENSE_POSITIONS[start + (round + index) % 4]);
}
