// Mini-games for young children (ages ~4–8): one active white piece and optional fixed friendly pawns.
// Collect the apples, reach the star, or capture every black piece — in as few moves as possible.
// Positions without kings are not legal chess, so this has its own small move generator.

export type PieceKind = "R" | "B" | "Q" | "K" | "N" | "P";
export type Goal = "apples" | "star" | "capture";

export interface BlackPiece {
    square: string;
    piece: PieceKind;
}

export interface BoardLevel {
    id: string; // "<world>-<n>", also used as the play-session key "mini:<id>"
    type: "board";
    piece: PieceKind;
    start: string;
    goal: Goal;
    apples?: string[];
    star?: string;
    friendlyPawns?: string[]; // Fixed white pawns; cannot be moved or captured by the practising piece
    targets?: BlackPiece[]; // Capturable black pieces; they attack the white piece after an unsafe move.
    guards?: BlackPiece[]; // Fixed black pieces that attack but cannot be captured.
}

export interface PuzzleLevel {
    id: string;
    type: "puzzles";
    tags: string[];
    startRating: number;
    count: number;
}

export interface PawnWarsLevel {
    id: string;
    type: "pawnWars";
    white: string[];
    black: string[];
}

export type MiniLevel = BoardLevel | PuzzleLevel | PawnWarsLevel;

export interface World {
    id: string;
    icon: string; // chess piece symbol shown on the world tile
    levels: MiniLevel[];
}

const board = (level: Omit<BoardLevel, "type">): BoardLevel => ({ type: "board", ...level });

// Learning order: straight lines, diagonals, both, one step, jumps, pawns, then capturing and checkmate.
export const WORLDS: World[] = [
    {
        id: "rook", icon: "♖", levels: [
            board({ id: "rook-1", piece: "R", start: "a1", goal: "apples", apples: ["a5"] }),
            board({ id: "rook-2", piece: "R", start: "a1", goal: "apples", apples: ["a5", "e5"] }),
            board({ id: "rook-3", piece: "R", start: "d4", goal: "apples", apples: ["d8", "h8", "h1"] }),
            board({ id: "rook-4", piece: "R", start: "a1", goal: "star", star: "a6", friendlyPawns: ["a4"] }),
            board({ id: "rook-5", piece: "R", start: "h1", goal: "apples", apples: ["a1", "a8", "h8", "e4"] }),
            board({ id: "rook-6", piece: "R", start: "e4", goal: "apples", apples: ["e8", "a4", "a8"], friendlyPawns: ["e6", "c4", "b7"] }),
        ],
    },
    {
        id: "bishop", icon: "♗", levels: [
            board({ id: "bishop-1", piece: "B", start: "c1", goal: "apples", apples: ["f4"] }),
            board({ id: "bishop-2", piece: "B", start: "c1", goal: "apples", apples: ["h6", "e3"] }),
            board({ id: "bishop-3", piece: "B", start: "f1", goal: "apples", apples: ["a6", "c8", "h3"] }),
            board({ id: "bishop-4", piece: "B", start: "d4", goal: "star", star: "h8", friendlyPawns: ["f6"] }),
            board({ id: "bishop-5", piece: "B", start: "a1", goal: "apples", apples: ["h8", "b8", "h2"] }),
            board({ id: "bishop-6", piece: "B", start: "e5", goal: "apples", apples: ["a1", "h2", "b8", "h8"], friendlyPawns: ["c7"] }),
        ],
    },
    {
        id: "queen", icon: "♕", levels: [
            board({ id: "queen-1", piece: "Q", start: "d1", goal: "apples", apples: ["d8", "h4"] }),
            board({ id: "queen-2", piece: "Q", start: "a1", goal: "apples", apples: ["h8", "h1", "a8"] }),
            board({ id: "queen-3", piece: "Q", start: "d4", goal: "apples", apples: ["d8", "h4", "b2"], friendlyPawns: ["d6", "f4", "c3"] }),
            board({ id: "queen-4", piece: "Q", start: "e1", goal: "star", star: "e8", friendlyPawns: ["e4", "d2", "f2", "c5", "g5"] }),
            board({ id: "queen-5", piece: "Q", start: "a8", goal: "apples", apples: ["c3", "f6", "h1", "b5"] }),
            board({ id: "queen-6", piece: "Q", start: "d5", goal: "apples", apples: ["a2", "g8", "h3", "b7"], friendlyPawns: ["c4", "e6", "f3"] }),
        ],
    },
    {
        id: "king", icon: "♔", levels: [
            board({ id: "king-1", piece: "K", start: "e1", goal: "apples", apples: ["e3"] }),
            board({ id: "king-2", piece: "K", start: "a1", goal: "apples", apples: ["c3", "a3"] }),
            board({ id: "king-3", piece: "K", start: "e4", goal: "apples", apples: ["e6", "g6", "g4"] }),
            board({ id: "king-4", piece: "K", start: "d1", goal: "star", star: "d5", friendlyPawns: ["c3", "d3", "e3"] }),
            board({ id: "king-5", piece: "K", start: "a8", goal: "apples", apples: ["b6", "d6", "d8"] }),
            board({ id: "king-6", piece: "K", start: "h1", goal: "star", star: "h6", friendlyPawns: ["g3", "h3", "f4", "g5", "h4"] }),
        ],
    },
    {
        id: "knight", icon: "♘", levels: [
            board({ id: "knight-1", piece: "N", start: "b1", goal: "apples", apples: ["c3"] }),
            board({ id: "knight-2", piece: "N", start: "b1", goal: "apples", apples: ["d2", "f3"] }),
            board({ id: "knight-3", piece: "N", start: "g1", goal: "star", star: "g3" }),
            board({ id: "knight-4", piece: "N", start: "d4", goal: "apples", apples: ["b5", "c6", "e6", "f5"] }),
            board({ id: "knight-5", piece: "N", start: "a1", goal: "star", star: "e5", friendlyPawns: ["a2", "b2", "c3"] }),
            board({ id: "knight-6", piece: "N", start: "e4", goal: "apples", apples: ["d6", "f2", "b5"] }),
        ],
    },
    {
        id: "pawn", icon: "♙", levels: [
            board({ id: "pawn-1", piece: "P", start: "e2", goal: "apples", apples: ["e4"] }),
            board({ id: "pawn-2", piece: "P", start: "e2", goal: "star", star: "e8" }),
            board({ id: "pawn-3", piece: "P", start: "d2", goal: "star", star: "e8", targets: [{ square: "e3", piece: "P" }], friendlyPawns: ["d3"] }),
            board({ id: "pawn-4", piece: "P", start: "c2", goal: "capture", targets: [{ square: "d3", piece: "P" }, { square: "e4", piece: "N" }, { square: "d5", piece: "N" }] }),
            { id: "pawn-5", type: "pawnWars", white: ["a2", "b2", "c2"], black: ["a7", "b7", "c7"] },
            { id: "pawn-6", type: "pawnWars", white: ["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"], black: ["a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7"] },
        ],
    },
    {
        id: "capture", icon: "⚔", levels: [
            board({ id: "capture-1", piece: "R", start: "a1", goal: "capture", targets: [{ square: "a5", piece: "P" }, { square: "e5", piece: "P" }] }),
            board({ id: "capture-2", piece: "B", start: "c1", goal: "capture", targets: [{ square: "g5", piece: "P" }, { square: "e7", piece: "N" }] }),
            board({ id: "capture-3", piece: "N", start: "b1", goal: "capture", targets: [{ square: "c3", piece: "P" }, { square: "e4", piece: "B" }, { square: "f6", piece: "R" }] }),
            board({ id: "capture-4", piece: "Q", start: "d1", goal: "capture", targets: [{ square: "d7", piece: "P" }, { square: "a4", piece: "N" }, { square: "h5", piece: "B" }, { square: "a7", piece: "R" }] }),
            board({ id: "capture-5", piece: "R", start: "a1", goal: "star", star: "h8", guards: [{ square: "f6", piece: "N" }] }),
            board({ id: "capture-6", piece: "K", start: "e1", goal: "star", star: "e6", guards: [{ square: "c5", piece: "B" }, { square: "h3", piece: "N" }] }),
        ],
    },
    {
        id: "mate", icon: "♚", levels: [
            { id: "mate-1", type: "puzzles", tags: ["mateIn1"], startRating: 400, count: 5 },
            { id: "mate-2", type: "puzzles", tags: ["mateIn1"], startRating: 550, count: 5 },
            { id: "mate-3", type: "puzzles", tags: ["mateIn1"], startRating: 700, count: 5 },
            { id: "mate-4", type: "puzzles", tags: ["mateIn1"], startRating: 850, count: 5 },
            { id: "mate-5", type: "puzzles", tags: ["backRankMate"], startRating: 700, count: 5 },
            { id: "mate-6", type: "puzzles", tags: ["mateIn2"], startRating: 800, count: 5 },
        ],
    },
];

export const miniKey = (levelId: string) => `mini:${levelId}`;
export const findLevel = (levelId: string) => WORLDS.flatMap(world => world.levels).find(level => level.id === levelId);

// ----- Board geometry -----

export const file = (square: string) => square.charCodeAt(0) - 97;
export const rank = (square: string) => Number(square[1]) - 1;
export const squareAt = (f: number, r: number) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? `${String.fromCharCode(97 + f)}${r + 1}` : null);

const LINES: Record<"R" | "B", [number, number][]> = {
    R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
};
const KNIGHT: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING: [number, number][] = [...LINES.R, ...LINES.B];

// Squares a piece can move to. `blocked` stops movement; `enemies` can be captured (and stop sliding).
// `forward` is the pawn direction (+1 for White).
export function pieceMoves(piece: PieceKind, from: string, blocked: Set<string>, enemies: Set<string>, forward = 1): string[] {
    const f = file(from);
    const r = rank(from);
    const result: string[] = [];
    const slide = (dirs: [number, number][]) => {
        for (const [df, dr] of dirs) {
            for (let step = 1; step < 8; step++) {
                const target = squareAt(f + df * step, r + dr * step);
                if (!target || blocked.has(target)) break;
                result.push(target);
                if (enemies.has(target)) break;
            }
        }
    };
    const jumps = (dirs: [number, number][]) => {
        for (const [df, dr] of dirs) {
            const target = squareAt(f + df, r + dr);
            if (target && !blocked.has(target)) result.push(target);
        }
    };
    if (piece === "R") slide(LINES.R);
    else if (piece === "B") slide(LINES.B);
    else if (piece === "Q") slide(KING);
    else if (piece === "K") jumps(KING);
    else if (piece === "N") jumps(KNIGHT);
    else {
        const one = squareAt(f, r + forward);
        if (one && !blocked.has(one) && !enemies.has(one)) {
            result.push(one);
            const two = squareAt(f, r + 2 * forward);
            const home = forward === 1 ? 1 : 6;
            if (r === home && two && !blocked.has(two) && !enemies.has(two)) result.push(two);
        }
        for (const df of [-1, 1]) {
            const diagonal = squareAt(f + df, r + forward);
            if (diagonal && enemies.has(diagonal)) result.push(diagonal);
        }
    }
    return result;
}

function remainingBlackPieces(level: BoardLevel, state: BoardState): BlackPiece[] {
    return [...(level.guards ?? []), ...(level.targets ?? []).filter(target => !state.captured.includes(target.square))];
}

function attacksFrom(level: BoardLevel, attacker: BlackPiece, pieces: BlackPiece[]): string[] {
    if (attacker.piece === "P") {
        return [-1, 1]
            .map(df => squareAt(file(attacker.square) + df, rank(attacker.square) - 1))
            .filter((square): square is string => square !== null);
    }
    // Include an occupied square, then stop the sliding ray there. Friendly
    // white pawns block the ray as real pieces, and can themselves be attacked.
    // The moving white piece vacates its square, so it must not hide danger.
    const occupied = new Set([...pieces.map(piece => piece.square), ...(level.friendlyPawns ?? [])]);
    return pieceMoves(attacker.piece, attacker.square, new Set(), occupied);
}

// All remaining black pieces attack; captures and occupied squares change the danger map.
export function guardedSquares(level: BoardLevel, state: BoardState = startState(level)): Set<string> {
    const pieces = remainingBlackPieces(level, state);
    const attacked = new Set<string>();
    for (const piece of pieces) {
        attacksFrom(level, piece, pieces).forEach(square => attacked.add(square));
    }
    return attacked;
}

// ----- Playing a board level -----

export interface BoardState {
    at: string;
    collected: string[]; // apples eaten
    captured: string[]; // target squares already taken
    moves: number;
}

export const startState = (level: BoardLevel): BoardState => ({ at: level.start, collected: [], captured: [], moves: 0 });

export function legalTargets(level: BoardLevel, state: BoardState): string[] {
    const blocked = new Set([...(level.friendlyPawns ?? []), ...(level.guards ?? []).map(guard => guard.square)]);
    const enemies = new Set((level.targets ?? []).map(target => target.square).filter(square => !state.captured.includes(square)));
    return pieceMoves(level.piece, state.at, blocked, enemies);
}

export type MoveOutcome =
    | { state: BoardState; result: "ok" | "won" }
    | { state: BoardState; result: "caught"; capturedBy: BlackPiece }
    | null;

export function playMove(level: BoardLevel, state: BoardState, to: string, from = state.at): MoveOutcome {
    if (from !== state.at) return null;
    if (!legalTargets(level, state).includes(to)) return null;
    const next: BoardState = {
        at: to,
        collected: level.apples?.includes(to) && !state.collected.includes(to) ? [...state.collected, to] : state.collected,
        captured: level.targets?.some(target => target.square === to) && !state.captured.includes(to) ? [...state.captured, to] : state.captured,
        moves: state.moves + 1,
    };
    // Evaluate the position after the player's capture, so the removed piece cannot attack.
    const pieces = remainingBlackPieces(level, next);
    const capturedBy = pieces.find(piece => attacksFrom(level, piece, pieces).includes(to));
    if (capturedBy) return { state: next, result: "caught", capturedBy };
    return { state: next, result: isComplete(level, next) ? "won" : "ok" };
}

export function isComplete(level: BoardLevel, state: BoardState) {
    if (level.goal === "apples") return (level.apples ?? []).every(apple => state.collected.includes(apple));
    if (level.goal === "star") return state.at === level.star;
    return (level.targets ?? []).every(target => state.captured.includes(target.square));
}

const stateKey = (state: BoardState) => `${state.at}|${[...state.collected].sort().join(",")}|${[...state.captured].sort().join(",")}`;

// Shortest winning sequence from a state (breadth-first search), or null if there is none.
export function solve(level: BoardLevel, from: BoardState = startState(level)): string[] | null {
    const queue: { state: BoardState; path: string[] }[] = [{ state: from, path: [] }];
    const seen = new Set([stateKey(from)]);
    while (queue.length) {
        const { state, path } = queue.shift()!;
        for (const to of legalTargets(level, state)) {
            const outcome = playMove(level, state, to);
            if (!outcome || outcome.result === "caught") continue;
            if (outcome.result === "won") return [...path, to];
            const key = stateKey(outcome.state);
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push({ state: outcome.state, path: [...path, to] });
        }
    }
    return null;
}

// 3 stars for the shortest solution, 2 for up to two extra moves, 1 otherwise.
export function boardStars(moves: number, best: number) {
    return moves <= best ? 3 : moves <= best + 2 ? 2 : 1;
}

// Puzzle levels: 5 right = 3 stars, 4 = 2, 3 = 1, fewer = try again.
export function puzzleStars(correct: number, count: number) {
    const missed = count - correct;
    return missed === 0 ? 3 : missed === 1 ? 2 : missed === 2 ? 1 : 0;
}

// ----- Pawn wars (all pawns, first to the last rank wins) -----

export interface PawnPosition {
    white: string[];
    black: string[];
    turn: "w" | "b";
}

export function pawnMoves(position: PawnPosition, side: "w" | "b"): { from: string; to: string }[] {
    const own = side === "w" ? position.white : position.black;
    const other = new Set(side === "w" ? position.black : position.white);
    const occupied = new Set([...position.white, ...position.black]);
    return own.flatMap(from => pieceMoves("P", from, occupied, other, side === "w" ? 1 : -1)
        .filter(to => !own.includes(to))
        .map(to => ({ from, to })));
}

export function applyPawnMove(position: PawnPosition, move: { from: string; to: string }): PawnPosition {
    const side = position.turn;
    const mine = (side === "w" ? position.white : position.black).map(square => (square === move.from ? move.to : square));
    const theirs = (side === "w" ? position.black : position.white).filter(square => square !== move.to);
    return side === "w" ? { white: mine, black: theirs, turn: "b" } : { white: theirs, black: mine, turn: "w" };
}

// "w" or "b" once a pawn reaches the far side or the player to move has no moves (they lose); otherwise null.
export function pawnWinner(position: PawnPosition): "w" | "b" | null {
    if (position.white.some(square => rank(square) === 7) || !position.black.length) return "w";
    if (position.black.some(square => rank(square) === 0) || !position.white.length) return "b";
    if (!pawnMoves(position, position.turn).length) return position.turn === "w" ? "b" : "w";
    return null;
}

// The computer's pawn: win if it can, capture safely, push a safe pawn, otherwise anything.
export function computerPawnMove(position: PawnPosition, random: () => number = Math.random) {
    const moves = pawnMoves(position, position.turn);
    if (!moves.length) return null;
    const scored = moves.map(move => {
        const next = applyPawnMove(position, move);
        let score = random();
        if (pawnWinner(next) === position.turn) score += 1000;
        if ((position.turn === "w" ? position.black : position.white).includes(move.to)) score += 5;
        const replies = pawnMoves(next, next.turn);
        if (replies.some(reply => reply.to === move.to)) score -= 4;
        if (replies.some(reply => pawnWinner(applyPawnMove(next, reply)) === next.turn)) score -= 100;
        score += (position.turn === "b" ? 7 - rank(move.to) : rank(move.to)) * 0.3;
        return { move, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].move;
}

// ----- World progress -----

// A world's tier: bronze when every level has at least 1 star, silver at 2, gold at 3.
export function worldTier(world: World, stars: Record<string, number>) {
    const minimum = Math.min(...world.levels.map(level => stars[miniKey(level.id)] ?? 0));
    return minimum >= 3 ? "gold" : minimum >= 2 ? "silver" : minimum >= 1 ? "bronze" : null;
}

// Levels open one after another inside a world; every world is open from the start.
export function levelOpen(world: World, index: number, stars: Record<string, number>) {
    return index === 0 || (stars[miniKey(world.levels[index - 1].id)] ?? 0) > 0;
}
