"use client";

import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { MAX_CAPTURES, isSolved, isStuck, parsePieces, playSoloMove, soloMoves, solveSolo, type SoloMove, type SoloPiece, type SoloPuzzle } from "@/lib/soloChess";

const DOTS: React.CSSProperties = { position: "absolute", top: 2, right: 4, display: "flex", gap: 2, pointerEvents: "none" };

// One solo chess puzzle: capture with every move until a single piece is left. Undo and start over are free;
// a hint marks the puzzle as finished with help, so it can come back later.
export default function SoloChessGame({ puzzle, onFinish }: { puzzle: SoloPuzzle; onFinish: (clean: boolean) => void }) {
    const t = useTranslations("SoloChess");
    const start = useMemo(() => parsePieces(puzzle.pieces), [puzzle]);
    const [history, setHistory] = useState<SoloPiece[][]>([start]);
    const [selected, setSelected] = useState<string | null>(null);
    const [hint, setHint] = useState<SoloMove | null>(null);
    const [helped, setHelped] = useState(false);
    const [noHint, setNoHint] = useState(false);
    const pieces = history[history.length - 1];
    const solved = isSolved(pieces);
    const stuck = isStuck(pieces);
    const targets = selected && !solved ? soloMoves(pieces, selected).map(move => move.to) : [];

    function play(move: SoloMove) {
        const next = playSoloMove(pieces, move);
        if (!next) return false;
        setHistory([...history, next]);
        setSelected(null);
        setHint(null);
        setNoHint(false);
        if (isSolved(next)) onFinish(!helped);
        return true;
    }

    function onSquareClick(square: string) {
        if (solved) return;
        if (selected && targets.includes(square)) {
            play({ from: selected, to: square });
            return;
        }
        const piece = pieces.find(entry => entry.square === square);
        setSelected(piece && soloMoves(pieces, square).length ? square : null);
    }

    function undo() {
        if (history.length < 2 || solved) return;
        setHistory(history.slice(0, -1));
        setSelected(null);
        setHint(null);
        setNoHint(false);
    }

    function restart() {
        setHistory([start]);
        setSelected(null);
        setHint(null);
        setNoHint(false);
    }

    function showHint() {
        const solution = solveSolo(pieces);
        setHelped(true);
        if (!solution?.length) {
            setNoHint(true);
            return;
        }
        setHint(solution[0]);
        setSelected(solution[0].from);
    }

    const position: Record<string, { pieceType: string }> = {};
    for (const piece of pieces) position[piece.square] = { pieceType: `w${piece.piece}` };

    const squareStyles: Record<string, React.CSSProperties> = {};
    if (selected) squareStyles[selected] = { boxShadow: "inset 0 0 0 4px #2563eb" };
    for (const square of targets) squareStyles[square] = { ...squareStyles[square], boxShadow: "inset 0 0 0 4px rgba(220, 38, 38, 0.85)" };
    if (hint) {
        squareStyles[hint.from] = { ...squareStyles[hint.from], backgroundColor: "rgba(250, 204, 21, 0.6)" };
        squareStyles[hint.to] = { ...squareStyles[hint.to], backgroundColor: "rgba(34, 197, 94, 0.6)" };
    }
    const left = new Map(pieces.map(piece => [piece.square, MAX_CAPTURES - piece.captures]));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{solved ? t("solvedTitle") : t("goal")}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("piecesLeft", { count: pieces.length })}</p>
            </div>
            <div className="relative w-full max-w-[560px] aspect-square rounded-lg overflow-hidden border-4 border-slate-700">
                <Chessboard
                    options={{
                        id: `solo-${puzzle.id}`,
                        position,
                        allowDragging: !solved,
                        canDragPiece: ({ square }) => !solved && !!square && soloMoves(pieces, square).length > 0,
                        onSquareClick: ({ square }) => onSquareClick(square),
                        onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? play({ from: sourceSquare, to: targetSquare }) : false),
                        squareStyles,
                        squareRenderer: ({ square, children }) => (
                            <div style={{ position: "relative", width: "100%", height: "100%", ...squareStyles[square] }}>
                                {children}
                                {left.has(square) && !solved && (
                                    <span style={DOTS} aria-hidden>
                                        {Array.from({ length: MAX_CAPTURES }, (_, index) => (
                                            <span key={index} style={{ width: 8, height: 8, borderRadius: 9999, border: "1px solid #1e293b", backgroundColor: index < left.get(square)! ? "#f59e0b" : "transparent" }} />
                                        ))}
                                    </span>
                                )}
                            </div>
                        ),
                    }}
                />
                {stuck && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-3 text-center text-white font-medium" role="status">
                        {t("stuck")}
                    </div>
                )}
            </div>
            {noHint && <p className="text-sm text-amber-700 dark:text-amber-300" role="status">{t("noHint")}</p>}
            {!solved && (
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={undo} disabled={history.length < 2} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium disabled:opacity-50">
                        <Undo2 className="h-4 w-4" /> {t("undo")}
                    </button>
                    <button type="button" onClick={restart} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium">
                        <RotateCcw className="h-4 w-4" /> {t("startOver")}
                    </button>
                    <button type="button" onClick={showHint} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-yellow-100 text-yellow-900 font-medium">
                        <Lightbulb className="h-4 w-4" /> {t("hint")}
                    </button>
                </div>
            )}
        </div>
    );
}
