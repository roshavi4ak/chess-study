import { Chess, type Color, type Move, type Square } from "chess.js";
import { learningMove } from "./puzzleLearning";

export const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const moveUci = (move: Move) => move.from + move.to + (move.promotion ?? "");
export function copyGame(game: Chess) {
    const history = game.history({ verbose: true });
    const copy = new Chess(history[0]?.before ?? game.fen());
    history.forEach(move => learningMove(copy, moveUci(move)));
    return copy;
}
export interface CaptureThreat { square: Square; from: Square; piece: string; reply: string; loss: number }

// Legal captures, including pins/check evasions. Recaptures distinguish equal trades from free material.
// This is an immediate material warning, not a claim about the full tactical evaluation.
export function captureThreats(fen: string, side: Color): CaptureThreat[] {
    const fields = fen.split(" ");
    const opponent = side === "w" ? "b" : "w";
    if (fields[1] !== opponent) { fields[1] = opponent; fields[3] = "-"; }
    const game = new Chess(fields.join(" "));
    const threats: CaptureThreat[] = [];
    for (const move of game.moves({ verbose: true })) {
        if (!move.captured || move.captured === "k") continue;
        game.move(move);
        const canRecapture = game.moves({ verbose: true }).some(reply => reply.to === move.to && reply.captured);
        const loss = PIECE_VALUES[move.captured] + (canRecapture ? -PIECE_VALUES[move.piece] : move.promotion ? PIECE_VALUES[move.promotion] - PIECE_VALUES.p : 0);
        game.undo();
        if (loss > 0) threats.push({ square: move.isEnPassant() ? `${move.to[0]}${move.from[1]}` as Square : move.to, from: move.from, piece: move.captured, reply: moveUci(move), loss });
    }
    return threats.sort((a, b) => b.loss - a.loss || a.square.localeCompare(b.square)).filter((item, index, list) => list.findIndex(other => other.square === item.square) === index);
}

export function moveWarning(fen: string, uci: string) {
    const game = new Chess(fen);
    const side = game.turn();
    const played = learningMove(game, uci);
    if (game.isGameOver()) return null;
    for (const reply of game.moves({ verbose: true })) {
        game.move(reply);
        const mate = game.isCheckmate();
        game.undo();
        if (mate) return { kind: "mate" as const, reply: moveUci(reply), piece: "k", square: reply.to };
    }
    const gain = (played.captured ? PIECE_VALUES[played.captured] : 0) + (played.promotion ? PIECE_VALUES[played.promotion] - PIECE_VALUES.p : 0);
    const threat = captureThreats(game.fen(), side).find(item => item.loss > gain);
    return threat ? { kind: "material" as const, reply: threat.reply, piece: threat.piece, square: threat.square } : null;
}

export function coachingPraise(fen: string, uci: string): "matePraise" | "castlePraise" | "rescuePraise" | "developPraise" | "capturePraise" | null {
    const game = new Chess(fen);
    const side = game.turn();
    const threatened = captureThreats(fen, side);
    const move = learningMove(game, uci);
    if (game.isCheckmate()) return "matePraise";
    if (moveWarning(fen, uci)) return null;
    if (move.isKingsideCastle() || move.isQueensideCastle()) return "castlePraise";
    if (threatened.length && captureThreats(game.fen(), side).length === 0) return "rescuePraise";
    if ((move.piece === "n" || move.piece === "b") && move.from[1] === (side === "w" ? "1" : "8") && move.to[1] !== move.from[1]) return "developPraise";
    return move.captured ? "capturePraise" : null;
}

export function coachingHint(fen: string) {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    const castle = moves.find(move => move.isKingsideCastle() || move.isQueensideCastle());
    const development = moves.filter(move => (move.piece === "n" || move.piece === "b") && move.from[1] === (game.turn() === "w" ? "1" : "8") && move.to[1] !== move.from[1]);
    const candidates = [...(castle ? [castle] : []), ...development, ...moves.filter(move => move.san.includes("#")), ...moves.filter(move => move.captured), ...moves];
    const safe = candidates.find(move => !moveWarning(fen, moveUci(move)));
    return safe ? { move: moveUci(safe), clue: game.inCheck() ? "escapeCheck" : castle === safe ? "castleClue" : development.includes(safe) ? "developClue" : captureThreats(fen, game.turn()).length ? "defendClue" : "thinkClue" } : null;
}

export function coachingGoals(moves: Move[], side: Color) {
    const mine = moves.filter(move => move.color === side);
    return { developed: new Set(mine.filter(move => (move.piece === "n" || move.piece === "b") && move.from[1] === (side === "w" ? "1" : "8") && move.to[1] !== move.from[1]).map(move => move.from)).size >= 2,
        castled: mine.some(move => move.isKingsideCastle() || move.isQueensideCastle()) };
}
