// Notation trainer: write down a move shown on the board, or play a move written in notation.
// Positions come from short random games, so every question is a legal chess position.

import { Chess, type Move } from "chess.js";

export type NotationLevel = 1 | 2 | 3 | 4;
export const NOTATION_LEVELS: NotationLevel[] = [1, 2, 3, 4];
export type NotationDirection = "write" | "play";
export const NOTATION_DIRECTIONS: NotationDirection[] = ["write", "play"];
export const NOTATION_ROUND = 10;

// Moves are always written with the English piece letters.
export const PIECE_LETTERS = ["K", "Q", "R", "B", "N"];
// Cyrillic letters that look like Latin ones, typed by mistake on a Bulgarian keyboard.
const LOOK_ALIKES: Record<string, string> = { "К": "K", "В": "B", "О": "O", "о": "o", "а": "a", "с": "c", "е": "e", "Х": "x", "х": "x" };

export interface NotationQuestion {
    fen: string; // position before the move
    san: string; // standard algebraic notation with English letters
    from: string;
    to: string;
    promotion?: string;
}

export const notationKey = (direction: NotationDirection, level: NotationLevel) => `notation:${direction}-${level}`;

const DISAMBIGUATED = /^[NBRQK]([a-h]|[1-8]|[a-h][1-8])x?[a-h][1-8]/;

// Which moves a level asks about.
export function fitsLevel(move: Pick<Move, "san">, level: NotationLevel): boolean {
    const { san } = move;
    const special = /[+#=]/.test(san) || san.startsWith("O-O");
    const capture = san.includes("x");
    const ambiguous = DISAMBIGUATED.test(san);
    if (level === 1) return !special && !capture && !ambiguous;
    if (level === 2) return capture && !special && !ambiguous;
    if (level === 3) return special && !ambiguous;
    return ambiguous;
}

// Level 3 asks about castling, promotion, mate and check equally often.
type SpecialKind = "castle" | "promote" | "mate" | "check";
const SPECIAL_KINDS: SpecialKind[] = ["castle", "promote", "mate", "check"];
const specialKind = (san: string): SpecialKind | null =>
    san.startsWith("O-O") ? "castle" : san.includes("=") ? "promote" : san.includes("#") ? "mate" : san.includes("+") ? "check" : null;

type Fits = (move: Move) => boolean;
const pickFrom = <T,>(items: T[], random: () => number) => items[Math.floor(random() * items.length)];
const question = (chess: Chess, move: Move): NotationQuestion => ({ fen: chess.fen(), san: move.san, from: move.from, to: move.to, promotion: move.promotion });

// One short random game from the starting position; null if no fitting move came up.
function fromRandomGame(fits: Fits, random: () => number): NotationQuestion | null {
    const chess = new Chess();
    const plies = 6 + Math.floor(random() * 40);
    for (let ply = 0; ply < plies && !chess.isGameOver(); ply++) {
        const moves = chess.moves({ verbose: true });
        const fitting = moves.filter(fits);
        // Ask once the game has developed a little.
        if (fitting.length && ply >= 4 && random() < 0.35) return question(chess, pickFrom(fitting, random));
        // Grabbing material now and then opens the position up for captures and checks.
        const greedy = moves.filter(move => move.captured);
        chess.move(pickFrom(greedy.length && random() < 0.3 ? greedy : moves, random));
    }
    return null;
}

const SQUARES = Array.from({ length: 64 }, (_, index) => `${"abcdefgh"[index % 8]}${Math.floor(index / 8) + 1}`);

// A small random endgame (two kings and a few pieces), where promotions and mates come up far more often.
function fromSmallEndgame(fits: Fits, random: () => number, withPawnOnSeventh: boolean): NotationQuestion | null {
    const turn = random() < 0.5 ? "w" : "b";
    const placed = new Map<string, string>();
    const place = (piece: string, squares = SQUARES) => {
        const free = squares.filter(square => !placed.has(square));
        if (free.length) placed.set(pickFrom(free, random), piece);
    };
    const own = (piece: string) => (turn === "w" ? piece.toUpperCase() : piece.toLowerCase());
    const theirs = (piece: string) => (turn === "w" ? piece.toLowerCase() : piece.toUpperCase());
    place("K");
    place("k");
    if (withPawnOnSeventh) place(own("p"), SQUARES.filter(square => square[1] === (turn === "w" ? "7" : "2")));
    place(own(pickFrom(["q", "r", "r"], random)));
    for (let extra = Math.floor(random() * 3); extra > 0; extra--) {
        const piece = pickFrom(["q", "r", "b", "n", "p"], random);
        const colour = random() < 0.5 ? own : theirs;
        place(colour(piece), piece === "p" ? SQUARES.filter(square => square[1] !== "1" && square[1] !== "8") : SQUARES);
    }
    const rows = [8, 7, 6, 5, 4, 3, 2, 1].map(rank => {
        let row = "";
        let empty = 0;
        for (const file of "abcdefgh") {
            const piece = placed.get(`${file}${rank}`);
            if (!piece) { empty += 1; continue; }
            row += `${empty || ""}${piece}`;
            empty = 0;
        }
        return row + (empty || "");
    });
    const fen = (side: string) => `${rows.join("/")} ${side} - - 0 1`;
    try {
        // The side that just moved cannot still be in check.
        if (new Chess(fen(turn === "w" ? "b" : "w")).isCheck()) return null;
        const chess = new Chess(fen(turn));
        const fitting = chess.moves({ verbose: true }).filter(fits);
        if (!fitting.length) return null;
        // Mostly the usual queen promotion; sometimes a knight, rook or bishop.
        const queens = fitting.filter(move => move.promotion === "q");
        return question(chess, pickFrom(queens.length && random() < 0.7 ? queens : fitting, random));
    } catch {
        return null; // e.g. kings next to each other
    }
}

// A legal position and a move in it that fits the level.
export function makeNotationQuestion(level: NotationLevel, random: () => number = Math.random): NotationQuestion {
    const kind = level === 3 ? pickFrom(SPECIAL_KINDS, random) : null;
    const fits: Fits = move => fitsLevel(move, level) && (kind === null || specialKind(move.san) === kind);
    for (let attempt = 0; attempt < 3000; attempt++) {
        const found = kind === "promote" || kind === "mate" ? fromSmallEndgame(fits, random, kind === "promote") : fromRandomGame(fits, random);
        if (found) return found;
    }
    throw new Error(`No notation question found for level ${level}`);
}

// Turns what a child typed into SAN: 0-0 for castling, "e8Q", stray spaces and Cyrillic look-alike letters are accepted.
export function normalizeAnswer(input: string): string {
    let answer = input.trim().replace(/\s+/g, "").replace(/[!?]+$/, "").replace(/e\.?p\.?$/i, "");
    answer = answer.replace(/[КВОоасеХх]/g, letter => LOOK_ALIKES[letter]);
    answer = answer.replace(/[X×:]/g, "x");
    if (/^[0Oo]-?[0Oo](-?[0Oo])?[+#]?$/.test(answer)) {
        const long = (answer.match(/[0Oo]/g) ?? []).length === 3;
        answer = `${long ? "O-O-O" : "O-O"}${answer.match(/[+#]$/)?.[0] ?? ""}`;
    }
    answer = answer.replace(/^([a-h](?:x[a-h])?[18])([QRBN])/, "$1=$2");
    return answer;
}

export type AnswerCheck = "exact" | "markOff" | "wrong";

// "markOff": the move is right but the check (+) or mate (#) sign is missing or wrong. It still counts as right.
export function checkWrittenAnswer(input: string, san: string): AnswerCheck {
    const answer = normalizeAnswer(input);
    if (answer === san) return "exact";
    const body = (text: string) => text.replace(/[+#]+$/, "");
    return body(answer) === body(san) && body(san) !== "" ? "markOff" : "wrong";
}

// The move a child played on the board, compared with the question.
export const playedRight = (question: NotationQuestion, move: { from: string; to: string; promotion?: string }) =>
    move.from === question.from && move.to === question.to && (question.promotion ?? "q") === (move.promotion ?? "q");

// 10 right = 3 stars, 8–9 = 2, 6–7 = 1.
export function notationStars(correct: number) {
    return correct >= NOTATION_ROUND ? 3 : correct >= 8 ? 2 : correct >= 6 ? 1 : 0;
}
