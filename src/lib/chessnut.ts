import { Chess } from "chess.js";

// Chessnut's classic BLE protocol (Air): github.com/chessnutech/Chessnut_eBoards.
const PIECES = ["", "q", "k", "b", "p", "n", "R", "P", "r", "B", "N", "Q", "K"];

export function placement(fen: string): string {
    return fen.split(" ")[0];
}

export function decodeChessnutPosition(packet: Uint8Array): string | null {
    if (packet.length < 34 || packet[0] !== 0x01) return null;
    const ranks: string[] = [];
    for (let row = 0; row < 8; row++) {
        let rank = "", empty = 0;
        for (let col = 7; col >= 0; col--) {
            const byte = packet[2 + Math.floor((row * 8 + col) / 2)];
            const code = col % 2 === 0 ? byte & 15 : byte >> 4;
            if (code >= PIECES.length) return null;
            if (!code) empty++;
            else {
                if (empty) rank += empty;
                empty = 0;
                rank += PIECES[code];
            }
        }
        if (empty) rank += empty;
        ranks.push(rank);
    }
    return ranks.join("/");
}

/** BLE notifications may split a report or contain several reports. */
export class ChessnutPositionReader {
    private bytes: number[] = [];
    push(chunk: Uint8Array): string[] {
        this.bytes.push(...chunk);
        const positions: string[] = [];
        while (this.bytes.length >= 2) {
            if (this.bytes[0] !== 0x01 || ![0x20, 0x22, 0x24].includes(this.bytes[1])) {
                this.bytes.shift();
                continue;
            }
            // Classic Air uses the fixed 01 24 header followed by 32 placement bytes.
            // Do not interpret 0x24 as 36 more bytes: older boards send only 34 total.
            // Also accept length-prefixed reports and skip optional trailing padding.
            const length = this.bytes[1] === 0x24 ? 34 : this.bytes[1] + 2;
            if (this.bytes.length < length) break;
            const position = decodeChessnutPosition(Uint8Array.from(this.bytes.splice(0, length)));
            if (position) positions.push(position);
        }
        return positions;
    }
}

export function chessnutLedCommand(squares: readonly string[]): Uint8Array<ArrayBuffer> {
    const command = new Uint8Array(10);
    command[0] = 0x0a;
    command[1] = 0x08;
    for (const square of squares) {
        if (!/^[a-h][1-8]$/.test(square)) continue;
        // First mask is rank 8; least significant bit is the h-file.
        command[2 + 8 - Number(square[1])] |= 1 << (7 - (square.charCodeAt(0) - 97));
    }
    return command;
}

export function expandPlacement(fen: string): string[] {
    return placement(fen).replace(/\//g, "").replace(/[1-8]/g, digit => ".".repeat(Number(digit))).split("");
}

export function differentSquares(expected: string, actual: string): string[] {
    const before = expandPlacement(expected), after = expandPlacement(actual);
    return before.flatMap((piece, index) => piece === after[index] ? [] : [`${"abcdefgh"[index % 8]}${8 - Math.floor(index / 8)}`]);
}

export type BoardMove = { from: string; to: string; promotion?: string };
export type PhysicalCandidate = { move: BoardMove; fen: string };
export type PhysicalMove = { kind: "same" | "adjusting" | "mismatch" } | { kind: "move"; move: BoardMove; uci: string };

/** Keep game metadata in chess.js; the board only reports piece placement. */
export function physicalMove(fen: string, observed: string, expectedMoves: readonly string[], custom?: readonly PhysicalCandidate[]): PhysicalMove {
    if (placement(fen) === observed) return { kind: "same" };
    const before = expandPlacement(fen), actual = expandPlacement(observed);
    if (actual.length !== 64) return { kind: "mismatch" };
    const candidates = custom ? custom.map(({ move, fen: target }) => ({ move, uci: move.from + move.to + (move.promotion ?? ""), after: placement(target) }))
        : new Chess(fen).moves({ verbose: true }).map(move => ({ move, uci: move.from + move.to + (move.promotion ?? ""), after: placement(move.after) }));
    const expected = candidates.filter(candidate => expectedMoves.includes(candidate.uci));
    const match = (items: typeof candidates) => items.find(candidate => candidate.after === observed);
    const accepted = match(expected);
    if (accepted) return { kind: "move", move: accepted.move, uci: accepted.uci };
    const partial = (items: typeof candidates) => items.some(candidate => {
        const target = expandPlacement(candidate.after);
        return actual.every((piece, index) => {
            if (before[index] === target[index]) return piece === before[index];
            // Lifts, capture removal, either half of castling, and a pawn awaiting replacement.
            return piece === "." || piece === before[index] || piece === target[index]
                || (!!candidate.move.promotion && index === (8 - Number(candidate.move.to[1])) * 8 + candidate.move.to.charCodeAt(0) - 97 && piece === before[(8 - Number(candidate.move.from[1])) * 8 + candidate.move.from.charCodeAt(0) - 97]);
        });
    });
    // A rook moved first during an expected castle must not be recorded as a wrong rook move.
    if (partial(expected)) return { kind: "adjusting" };
    const other = match(candidates);
    if (other) return { kind: "move", move: other.move, uci: other.uci };
    return { kind: partial(candidates) ? "adjusting" : "mismatch" };
}

export function piecesPlacement(pieces: Record<string, { pieceType: string }>): string {
    const ranks: string[] = [];
    for (let rank = 8; rank >= 1; rank--) {
        let row = "", empty = 0;
        for (const file of "abcdefgh") {
            const type = pieces[`${file}${rank}`]?.pieceType;
            if (!type) { empty++; continue; }
            if (empty) { row += empty; empty = 0; }
            row += type[0] === "w" ? type[1].toUpperCase() : type[1].toLowerCase();
        }
        if (empty) row += empty;
        ranks.push(row);
    }
    return ranks.join("/");
}

export function movedPieces(pieces: Record<string, { pieceType: string }>, from: string, to: string) {
    const next = { ...pieces, [to]: pieces[from] };
    delete next[from];
    return piecesPlacement(next);
}

export function liftedSquare(expected: string, actual: string): string | null {
    const squares = differentSquares(expected, actual);
    if (squares.length !== 1) return null;
    const square = squares[0], index = (8 - Number(square[1])) * 8 + square.charCodeAt(0) - 97;
    return expandPlacement(expected)[index] !== "." && expandPlacement(actual)[index] === "." ? square : null;
}
