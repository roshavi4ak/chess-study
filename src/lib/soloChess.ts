// Solo chess: every piece on the board is White and every move must be a capture.
// Each piece may capture at most twice, the king can never be captured, and the
// puzzle is solved when only one piece is left. Positions are not legal chess
// (no kings required, pawns never promote), so the mini-game move generator is reused.

import { pieceMoves, rank, type PieceKind } from "./miniGames";

export const MAX_CAPTURES = 2;

export interface SoloPiece {
    square: string;
    piece: PieceKind;
    captures: number; // captures this piece has already made
}

export type SoloBand = "easy" | "medium" | "hard";
export const SOLO_BANDS: SoloBand[] = ["easy", "medium", "hard"];

export interface SoloPuzzle {
    id: string; // "solo-001"; the play-session key is "solo:<id>"
    band: SoloBand;
    pieces: string[]; // e.g. ["Rd4", "Nb3", "Pc4"]
    solutions: number; // how many different capture orders win (fewer = harder)
}

export interface SoloMove {
    from: string;
    to: string;
}

export const soloKey = (puzzleId: string) => `solo:${puzzleId}`;

export function parsePieces(pieces: string[]): SoloPiece[] {
    return pieces.map(entry => ({ piece: entry[0] as PieceKind, square: entry.slice(1), captures: 0 }));
}

// Captures available to the piece on `from` (all of them when `from` is omitted).
export function soloMoves(pieces: SoloPiece[], from?: string): SoloMove[] {
    const occupied = new Set(pieces.map(piece => piece.square));
    const capturable = new Set(pieces.filter(piece => piece.piece !== "K").map(piece => piece.square));
    return pieces
        .filter(piece => piece.captures < MAX_CAPTURES && (from === undefined || piece.square === from))
        .flatMap(piece => pieceMoves(piece.piece, piece.square, new Set(), occupied)
            .filter(to => capturable.has(to) && to !== piece.square)
            .map(to => ({ from: piece.square, to })));
}

// The position after a capture, or null if the capture is not allowed.
export function playSoloMove(pieces: SoloPiece[], move: SoloMove): SoloPiece[] | null {
    if (!soloMoves(pieces, move.from).some(option => option.to === move.to)) return null;
    return pieces
        .filter(piece => piece.square !== move.to)
        .map(piece => (piece.square === move.from ? { ...piece, square: move.to, captures: piece.captures + 1 } : piece));
}

export const isSolved = (pieces: SoloPiece[]) => pieces.length === 1;
export const isStuck = (pieces: SoloPiece[]) => pieces.length > 1 && soloMoves(pieces).length === 0;

const stateKey = (pieces: SoloPiece[]) => pieces.map(piece => `${piece.piece}${piece.square}${piece.captures}`).sort().join(" ");

// A winning sequence of captures from this position, or null when there is none.
export function solveSolo(pieces: SoloPiece[], dead = new Set<string>()): SoloMove[] | null {
    if (isSolved(pieces)) return [];
    const key = stateKey(pieces);
    if (dead.has(key)) return null;
    for (const move of soloMoves(pieces)) {
        const rest = solveSolo(playSoloMove(pieces, move)!, dead);
        if (rest) return [move, ...rest];
    }
    dead.add(key);
    return null;
}

// Number of different winning capture orders, stopping at `cap`.
export function countSoloSolutions(pieces: SoloPiece[], cap = 1000): number {
    const memo = new Map<string, number>();
    const count = (position: SoloPiece[]): number => {
        if (isSolved(position)) return 1;
        const key = stateKey(position);
        const known = memo.get(key);
        if (known !== undefined) return known;
        let total = 0;
        for (const move of soloMoves(position)) {
            total += count(playSoloMove(position, move)!);
            if (total >= cap) break;
        }
        memo.set(key, Math.min(total, cap));
        return Math.min(total, cap);
    };
    return count(pieces);
}

// ----- Building puzzles backwards from the last piece -----

const PIECES_TO_ADD: PieceKind[] = ["P", "P", "N", "N", "B", "B", "R", "R", "Q"];
const LAST_PIECES: PieceKind[] = ["K", "Q", "R", "R", "B", "N", "N", "P"];
const SQUARES = Array.from({ length: 64 }, (_, index) => `${"abcdefgh"[index % 8]}${Math.floor(index / 8) + 1}`);

const pick = <T,>(items: T[], random: () => number) => items[Math.floor(random() * items.length)];

// Pawns never stand on the first or last rank.
const pawnSquareOk = (square: string) => rank(square) > 0 && rank(square) < 7;

// Undo one capture: a piece that ended on `square` came from some empty square and took a new piece there.
function uncapture(pieces: SoloPiece[], random: () => number): SoloPiece[] | null {
    const movers = pieces.filter(piece => piece.captures < MAX_CAPTURES);
    if (!movers.length) return null;
    const mover = pick(movers, random);
    const added = pick(PIECES_TO_ADD, random);
    if (added === "P" && !pawnSquareOk(mover.square)) return null;
    const others = pieces.filter(piece => piece !== mover);
    const occupied = new Set(others.map(piece => piece.square));
    const origins = SQUARES.filter(from => {
        if (from === mover.square || occupied.has(from)) return false;
        if (mover.piece === "P" && !pawnSquareOk(from)) return false;
        // From `from`, with the captured piece standing on the target square, the mover must reach it.
        const board = new Set([...occupied, mover.square]);
        return pieceMoves(mover.piece, from, new Set(), board).includes(mover.square)
            && (mover.piece !== "P" || from[0] !== mover.square[0]);
    });
    if (!origins.length) return null;
    const from = pick(origins, random);
    return [
        ...others,
        { piece: mover.piece, square: from, captures: mover.captures + 1 },
        { piece: added, square: mover.square, captures: 0 },
    ];
}

// A random solvable puzzle with `count` pieces, or null if this attempt got stuck.
export function buildSoloPosition(count: number, random: () => number): SoloPiece[] | null {
    let last = pick(LAST_PIECES, random);
    let square = pick(SQUARES, random);
    if (last === "P" && !pawnSquareOk(square)) last = "N";
    // Pawns cannot capture onto the last rank either.
    if (last === "P" && rank(square) === 7) square = `${square[0]}7`;
    let pieces: SoloPiece[] | null = [{ piece: last, square, captures: 0 }];
    for (let tries = 0; pieces && pieces.length < count && tries < 200; tries++) {
        pieces = uncapture(pieces, random) ?? pieces;
    }
    if (!pieces || pieces.length !== count) return null;
    // Every piece starts the puzzle fresh; the capture counters were only for building it.
    return pieces.map(piece => ({ ...piece, captures: 0 }));
}

export const formatPieces = (pieces: SoloPiece[]) => pieces.map(piece => `${piece.piece}${piece.square}`).sort();

// Unsolved puzzles first, in order; ones skipped this visit go to the back of the queue.
export function nextSoloPuzzle(puzzles: SoloPuzzle[], solved: Set<string>, skipped: string[] = [], current?: string): SoloPuzzle | null {
    const open = puzzles.filter(puzzle => !solved.has(puzzle.id) && puzzle.id !== current);
    const fresh = open.filter(puzzle => !skipped.includes(puzzle.id));
    if (fresh.length) return fresh[0];
    const later = open.sort((a, b) => skipped.indexOf(a.id) - skipped.indexOf(b.id));
    // Skipping the only puzzle left brings the same puzzle back.
    return later[0] ?? puzzles.find(puzzle => puzzle.id === current && !solved.has(puzzle.id)) ?? null;
}
