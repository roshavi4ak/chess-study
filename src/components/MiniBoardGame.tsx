"use client";

import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { Lightbulb, RotateCcw } from "lucide-react";
import { boardStars, guardedSquares, legalTargets, playMove, solve, startState, type BlackPiece, type BoardLevel, type BoardState } from "@/lib/miniGames";

const OVERLAY: React.CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontSize: "min(7vw, 2.6rem)" };

// One white piece collecting apples, reaching the star or capturing black pieces. No losing: try again any time.
export default function MiniBoardGame({ level, onComplete }: { level: BoardLevel; onComplete: (stars: number, moves: number) => void }) {
    const t = useTranslations("MiniGames");
    const [state, setState] = useState<BoardState>(() => startState(level));
    const [tries, setTries] = useState(0);
    const [capturedBy, setCapturedBy] = useState<BlackPiece | null>(null);
    const caught = capturedBy !== null;
    const [won, setWon] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const best = useMemo(() => solve(level)?.length ?? 1, [level]);
    const danger = useMemo(() => guardedSquares(level, state), [level, state]);
    const targets = won || caught ? [] : legalTargets(level, state);

    function reset() {
        setState(startState(level));
        setCapturedBy(null);
        setHint(null);
        setTries(value => value + 1);
    }

    function handleMove(square: string, from = state.at) {
        if (won || caught) return;
        const outcome = playMove(level, state, square, from);
        if (!outcome) return;
        setHint(null);
        setState(outcome.state);
        if (outcome.result === "caught") setCapturedBy(outcome.capturedBy);
        if (outcome.result === "won") {
            setWon(true);
            onComplete(boardStars(outcome.state.moves, best), outcome.state.moves);
        }
    }

    function showHint() {
        setHint(solve(level, state)?.[0] ?? null);
    }

    const position: Record<string, { pieceType: string }> = { [state.at]: { pieceType: `w${level.piece}` } };
    for (const square of level.friendlyPawns ?? []) position[square] = { pieceType: "wP" };
    for (const target of level.targets ?? []) if (!state.captured.includes(target.square) && target.square !== state.at) position[target.square] = { pieceType: `b${target.piece}` };
    for (const guard of level.guards ?? []) position[guard.square] = { pieceType: `b${guard.piece}` };
    if (capturedBy) {
        delete position[capturedBy.square];
        position[state.at] = { pieceType: `b${capturedBy.piece}` };
    }

    const squareStyles: Record<string, React.CSSProperties> = {};
    if (!won && !caught) squareStyles[state.at] = { boxShadow: "inset 0 0 0 3px #2563eb" };
    for (const square of danger) squareStyles[square] = { backgroundColor: "#f87171" };
    for (const square of targets) squareStyles[square] = { ...squareStyles[square], backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.28) 22%, transparent 23%)" };
    if (hint) squareStyles[hint] = { ...squareStyles[hint], boxShadow: "inset 0 0 0 4px rgba(34, 197, 94, 0.95)" };

    const apples = new Set((level.apples ?? []).filter(apple => !state.collected.includes(apple)));
    const needsHelp = tries >= 2 || state.moves > best + 2 || caught;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {level.goal === "apples" ? t("goalApples") : level.goal === "star" ? (level.guards?.length ? t("goalStarSafe") : t("goalStar")) : t("goalCapture")}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("movesCount", { moves: state.moves, best })}</p>
            </div>
            {!!level.friendlyPawns?.length && <p className="text-sm text-gray-600 dark:text-gray-300">{t(level.piece === "N" ? "friendlyPawnsKnight" : "friendlyPawns", { piece: t(`piece_${level.piece}`) })}</p>}
            <div className="relative w-full max-w-[560px] aspect-square rounded-lg overflow-hidden border-4 border-green-700">
                <Chessboard
                    options={{
                        id: `mini-${level.id}`,
                        position,
                        allowDragging: !won && !caught,
                        canDragPiece: ({ square }) => !won && !caught && square === state.at,
                        onSquareClick: ({ square }) => handleMove(square),
                        onPieceDrop: ({ sourceSquare, targetSquare }) => { if (targetSquare) handleMove(targetSquare, sourceSquare); return false; },
                        squareStyles,
                        lightSquareStyle: { backgroundColor: "#e9f5db" },
                        darkSquareStyle: { backgroundColor: "#97c279" },
                        squareRenderer: ({ square, children }) => (
                            <div style={{ position: "relative", width: "100%", height: "100%", ...squareStyles[square] }}>
                                {children}
                                {apples.has(square) && <span style={OVERLAY}>🍎</span>}
                                {level.star === square && state.at !== square && <span style={OVERLAY}>⭐</span>}
                            </div>
                        ),
                    }}
                />
                {caught && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 text-center space-y-3 shadow-xl">
                            <p className="text-xl font-bold">😮 {t("caught")}</p>
                            <button type="button" onClick={reset} className="px-5 py-2 rounded-lg bg-green-600 text-white font-bold">{t("tryAgain")}</button>
                        </div>
                    </div>
                )}
            </div>
            {!won && (
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={reset} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium">
                        <RotateCcw className="h-4 w-4" /> {t("startOver")}
                    </button>
                    {needsHelp && !caught && (
                        <button type="button" onClick={showHint} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-yellow-100 text-yellow-900 font-medium">
                            <Lightbulb className="h-4 w-4" /> {t("showMe")}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
