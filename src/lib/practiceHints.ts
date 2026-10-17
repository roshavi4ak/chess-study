import { Chess } from "chess.js";

interface HintNode {
    fen: string;
    notes: string | null;
    children: { move: string | null; fen: string }[];
}

/** Notes belong to this position; child notes describe a different board. */
export function getPracticeHint(node: HintNode) {
    const moves: string[] = [];
    for (const child of node.children) {
        if (!child.move) continue;
        try {
            const game = new Chess(node.fen);
            const move = game.move({
                from: child.move.slice(0, 2),
                to: child.move.slice(2, 4),
                promotion: child.move[4],
            });
            if (game.fen() === child.fen && !moves.includes(move.san)) moves.push(move.san);
        } catch {
            // Invalid saved moves must never be presented as instructions.
        }
    }
    return { moves, notes: node.notes?.trim() || null };
}

export function formatPracticeHint(node: HintNode, expectedMoves: (moves: string) => string) {
    const hint = getPracticeHint(node);
    if (hint.moves.length === 0) return "";
    const instruction = expectedMoves(hint.moves.join(" / "));
    return hint.notes ? `${instruction}\n\n${hint.notes}` : instruction;
}
