import { Chess, type Color, type Square } from "chess.js";
import type { EndgameId } from "./endgameTraining";
import { learningMove } from "./puzzleLearning";

const file = (square: string) => square.charCodeAt(0) - 97;
const rank = (square: string) => Number(square[1]) - 1;
export const kingDistance = (a: string, b: string) => Math.max(Math.abs(file(a) - file(b)), Math.abs(rank(a) - rank(b)));
export const squareColor = (square: string) => (file(square) + rank(square)) % 2 === 0 ? "dark" : "light";
const corners: Square[] = ["a1", "a8", "h1", "h8"];
const neighbours = (square: string): Square[] => {
    const result: Square[] = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
        const f = file(square) + x, r = rank(square) + y;
        if ((x || y) && f >= 0 && f < 8 && r >= 0 && r < 8) result.push(`${"abcdefgh"[f]}${r + 1}` as Square);
    }
    return result;
};
function kingMoves(game: Chess, side: Color, square: Square) {
    const fields = game.fen().split(" "); fields[1] = side; fields[3] = "-";
    return new Chess(fields.join(" ")).moves({ square, verbose: true }).map(move => move.to);
}
export function pawnKeySquares(pawn: Square): Square[] {
    if ("ah".includes(pawn[0])) return [];
    const targetRank = Math.min(7, rank(pawn) + (rank(pawn) >= 4 ? 1 : 2));
    return [-1, 0, 1].map(offset => `${"abcdefgh"[file(pawn) + offset]}${targetRank + 1}` as Square);
}

// Explanation keys are chosen from verified geometry and legal move effects. A tablebase
// move is never called "approach", "opposition" or "shrink" unless it actually does that.
export function endgameHintContext(id: EndgameId, fen: string, uci: string) {
    try {
        const game = new Chess(fen);
        const pieces = game.board().flat().filter(piece => piece !== null);
        const king = pieces.find(piece => piece.type === "k" && piece.color === "w")!;
        const enemy = pieces.find(piece => piece.type === "k" && piece.color === "b")!;
        const pawn = pieces.find(piece => piece.type === "p");
        const bishop = pieces.find(piece => piece.type === "b" && piece.color === "w");
        const heavy = pieces.find(piece => (piece.type === "q" || piece.type === "r") && piece.color === "w");
        const before = kingMoves(game, "b", enemy.square).length;
        const next = new Chess(fen), move = learningMove(next, uci);
        const after = kingMoves(next, "b", enemy.square).length;
        const newKing = move.piece === "k" ? move.to : king.square;
        const covered = neighbours(enemy.square).filter(square => next.isAttacked(square, "w"));
        const matchingCorners = bishop ? corners.filter(square => squareColor(square) === squareColor(bishop.square)) : [];
        const keys = pawn?.color === "w" ? pawnKeySquares(pawn.square) : [];
        const promotion = pawn ? `${pawn.square[0]}${pawn.color === "w" ? "8" : "1"}` as Square : null;
        let plan: string;
        if (id === "queenMate" || id === "rookMate") plan = file(enemy.square) === 0 || file(enemy.square) === 7 || rank(enemy.square) === 0 || rank(enemy.square) === 7 ? "edge" : "fence";
        else if (id === "promotion" || id === "opposition") plan = keys.length ? "pawn" : "rookPawn";
        else if (id === "holdDraw") plan = pawn ? "corner" : "survive";
        else plan = id === "bishopPairMate" ? "bishops" : matchingCorners.includes(enemy.square) ? "bishopKnightCorner" : "bishopKnight";
        let reason: string;
        if (next.isCheckmate()) reason = "mate";
        else if (next.isStalemate()) reason = "stalemate";
        else if (id === "holdDraw" && next.isInsufficientMaterial()) reason = "drawCapture";
        else if (move.promotion) reason = "promotion";
        else if (id === "holdDraw") reason = promotion && newKing === promotion ? "reachCorner" : promotion && kingDistance(newKing, promotion) < kingDistance(king.square, promotion) ? "approachCorner" : "holdCorner";
        else if (pawn?.color === "w" && move.piece === "p") reason = next.isAttacked(move.to, "w") ? "supportedPawn" : "pawnStep";
        else if (pawn?.color === "w" && move.piece === "k" && keys.includes(move.to)) reason = "keySquare";
        else if (pawn?.color === "w" && move.piece === "k" && (
            file(move.to) === file(enemy.square) && Math.abs(rank(move.to) - rank(enemy.square)) === 2 ||
            rank(move.to) === rank(enemy.square) && Math.abs(file(move.to) - file(enemy.square)) === 2
        ) && !next.get(`${"abcdefgh"[(file(move.to) + file(enemy.square)) / 2]}${(rank(move.to) + rank(enemy.square)) / 2 + 1}` as Square)) reason = "opposition";
        else if (move.piece === "k") reason = kingDistance(move.to, enemy.square) < kingDistance(king.square, enemy.square) ? "kingApproach" : "kingWall";
        else if (move.piece === "n") reason = "knight";
        else if (move.piece === "b") reason = "bishop";
        else if (after < before) reason = "restrict";
        else reason = next.inCheck() ? "checkFence" : "keepFence";
        if (next.isCheckmate()) plan = "finish";
        else if (move.promotion) plan = "promoteNow";
        else if (reason === "drawCapture") plan = "takePawn";
        else if (game.inCheck()) plan = "inCheck";
        const focus = id === "bishopKnightMate" ? matchingCorners : id === "holdDraw" ? promotion ? [promotion] : [] : keys;
        return { plan, reason, focus, covered, piece: move.piece, color: bishop ? squareColor(bishop.square) : null,
            values: { king: king.square, enemyKing: enemy.square, pawn: pawn?.square ?? "", bishop: bishop?.square ?? "", heavy: heavy?.square ?? "", keys: keys.join(", "), corner: promotion ?? "", corners: matchingCorners.join(", "),
                from: move.from, to: move.to, move: move.san, before, after, distance: kingDistance(king.square, enemy.square), covered: covered.join(", ") } };
    } catch { return null; }
}
