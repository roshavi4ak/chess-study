import { Chess, type Square } from "chess.js";

export function learningMove(game: Chess, move: string) {
    return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)
        ? game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
        : game.move(move);
}

// Clues describe verified move properties, never a motif guessed from a puzzle tag.
export function moveClue(fen: string, expected: string) {
    try {
        const game = new Chess(fen);
        const move = learningMove(game, expected);
        return { from: move.from, to: move.to, san: move.san, piece: move.piece,
            clue: game.isCheckmate() ? "mate" : game.inCheck() ? "check" : move.promotion ? "promotion" : move.captured ? "capture" : "think" };
    } catch { return null; }
}

export function consequencePosition(fen: string, move: string, reply?: string) {
    const game = new Chess(fen);
    const played = learningMove(game, move);
    const afterMove = game.fen();
    const response = reply ? learningMove(game, reply) : null;
    return { afterMove, afterReply: game.fen(), move: played.san, reply: response?.san ?? null,
        reason: game.isCheckmate() ? "mateReply" : response?.captured ? "captureReply" : game.inCheck() ? "checkReply" : "possibleReply",
        captured: response?.captured ?? null, from: response?.from ?? played.from, to: response?.to ?? played.to };
}

export function attemptedUci(fen: string, from: string, to: string, promotion = "q") {
    try {
        const game = new Chess(fen);
        const move = game.move({ from: from as Square, to: to as Square, promotion });
        return move.from + move.to + (move.promotion ?? "");
    } catch { return null; }
}
