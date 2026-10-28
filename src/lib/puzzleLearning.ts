import { Chess, type Color, type Square } from "chess.js";

export function learningMove(game: Chess, move: string) {
    return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)
        ? game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
        : game.move(move);
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const SQUARES = "abcdefgh".split("").flatMap(file => "12345678".split("").map(rank => `${file}${rank}` as Square));
const other = (color: Color) => color === "w" ? "b" : "w";

// The same position with the other side to move, as if the side to move passed.
function passTurn(game: Chess) {
    const fields = game.fen().split(" ");
    fields[1] = other(fields[1] as Color);
    fields[3] = "-";
    try { return new Chess(fields.join(" ")); } catch { return null; }
}

function threatensMate(game: Chess, attacker: Color) {
    const passed = game.turn() === attacker ? game : passTurn(game);
    return !!passed && passed.moves({ verbose: true }).some(move => move.san.endsWith("#"));
}

// A victim piece is under real threat when an attacker can take it for less, or it is undefended.
function threatened(game: Chess, victim: Color, by?: Square) {
    return SQUARES.filter(square => {
        const piece = game.get(square);
        if (!piece || piece.color !== victim || piece.type === "k") return false;
        const attackers = game.attackers(square, other(victim)).filter(from => !by || from === by);
        if (!attackers.length) return false;
        const cheapest = Math.min(...attackers.map(from => VALUE[game.get(from)!.type]));
        return cheapest < VALUE[piece.type] || !game.attackers(square, victim).length;
    });
}

function pinsOrSkewers(game: Chess, at: Square, color: Color) {
    const piece = game.get(at);
    if (!piece || !"brq".includes(piece.type)) return false;
    const lines = [...(piece.type !== "b" ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : []), ...(piece.type !== "r" ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [])];
    return lines.some(([df, dr]) => {
        const seen = [];
        for (let f = at.charCodeAt(0) - 97 + df, r = Number(at[1]) - 1 + dr; f >= 0 && f < 8 && r >= 0 && r < 8 && seen.length < 2; f += df, r += dr) {
            const found = game.get(`${String.fromCharCode(97 + f)}${r + 1}` as Square);
            if (found) seen.push(found);
        }
        const [front, back] = seen;
        return front?.color === other(color) && back?.color === other(color)
            && VALUE[back.type] > VALUE[front.type] && VALUE[back.type] > VALUE[piece.type];
    });
}

// Clues describe verified move properties, never a motif guessed from a puzzle tag.
export function moveClue(fen: string, expected: string) {
    try {
        const game = new Chess(fen);
        const us = game.turn(), them = other(us);
        const threatsBefore = threatened(game, them), dangerBefore = threatened(game, us);
        const mateDangerBefore = threatensMate(game, them);
        const move = learningMove(game, expected);
        const forked = threatened(game, them, move.to);
        const clue = game.isCheckmate() ? "mate" : game.inCheck() ? "check" : move.promotion ? "promotion" : move.captured ? "capture"
            : threatensMate(game, us) ? "mateThreat"
            : forked.length >= 2 ? "fork"
            : pinsOrSkewers(game, move.to, us) ? "pin"
            : threatened(game, them).some(square => !threatsBefore.includes(square)) ? "threat"
            : (mateDangerBefore && !threatensMate(game, them)) || threatened(game, us).length < dangerBefore.length ? "defend"
            : move.piece === "p" && "67".includes(us === "w" ? move.to[1] : String(9 - Number(move.to[1]))) ? "advance"
            : move.piece === "k" ? "king"
            : "quiet";
        return { from: move.from, to: move.to, san: move.san, piece: move.piece, clue };
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
