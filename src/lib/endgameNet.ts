import { Chess, type PieceSymbol, type Square } from "chess.js";
import type { EndgameId } from "./endgameTraining";

export const MATE_LESSONS: readonly EndgameId[] = ["queenMate", "rookMate", "bishopPairMate", "bishopKnightMate"];
export interface NetControl { square: Square; by: { square: Square; piece: PieceSymbol }[] }

/** Inspect Black's actual one-move escapes, even when the teaching board has White to move. */
export function endgameNet(game: Chess) {
    const king = game.board().flat().find(piece => piece?.color === "b" && piece.type === "k");
    if (!king) return null;
    const fen = game.fen().split(" ");
    fen[1] = "b";
    fen[3] = "-";
    const defender = new Chess(fen.join(" "));
    // Retreating can uncover an attack through the king's old square.
    const vacated = new Chess(game.fen());
    vacated.remove(king.square);
    const escapes = defender.moves({ verbose: true }).filter(move => move.piece === "k").map(move => move.to).sort();
    const blocked: NetControl[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const file = king.square.charCodeAt(0) + dx, rank = Number(king.square[1]) + dy;
        if (file < 97 || file > 104 || rank < 1 || rank > 8) continue;
        const square = `${String.fromCharCode(file)}${rank}` as Square;
        if (!escapes.includes(square)) blocked.push({ square, by: vacated.attackers(square, "w").map(from => ({ square: from, piece: game.get(from)!.type })) });
    }
    return { king: king.square, escapes, blocked: blocked.sort((a, b) => a.square.localeCompare(b.square)), inCheck: defender.isCheck() };
}
