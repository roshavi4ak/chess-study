"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { applyExerciseMove, attemptExerciseMove, exerciseCredit, nextExerciseMove, retryExercise, showExerciseSolution, startExercise, type LevelExercise } from "@/lib/levelExercises";

// After a correct move the opponent replies on its own, as in the puzzle boards.
const REPLY_DELAY_MS = 350;

// Learning feedback is deliberately separate from the timed, one-try boards.
export default function LevelExerciseBoard({ exercise, onContinue, last }: { exercise: LevelExercise; onContinue: (unassisted: boolean) => void; last: boolean }) {
    const t = useTranslations("LevelExercises");
    const [attempt, setAttempt] = useState(() => startExercise(exercise));
    const [selected, setSelected] = useState<Square | null>(null);
    const advanced = useRef(false);
    const game = useMemo(() => new Chess(attempt.fen), [attempt.fen]);
    const side = useMemo(() => new Chess(exercise.fen).turn(), [exercise.fen]);
    const ready = attempt.status === "playing";
    const complete = attempt.status === "complete" || attempt.status === "reviewed";
    const reviewing = attempt.status === "solution" || attempt.status === "reviewed";
    const nextUci = exercise.moves[attempt.index];
    const nextSan = useMemo(() => nextUci ? applyExerciseMove(new Chess(attempt.fen), nextUci).san : "", [attempt.fen, nextUci]);

    useEffect(() => {
        if (attempt.status !== "step") return;
        const timer = setTimeout(() => setAttempt(previous => nextExerciseMove(exercise, previous)), REPLY_DELAY_MS);
        return () => clearTimeout(timer);
    }, [attempt.status, attempt.index, exercise]);

    function move(from: string, to: string) {
        if (!ready || from === to) return;
        setAttempt(previous => attemptExerciseMove(exercise, previous, { from, to }));
        setSelected(null);
    }

    function squareClick(square: string) {
        if (!ready) return;
        const sq = square as Square;
        if (game.get(sq)?.color === side) setSelected(selected === sq ? null : sq);
        else if (selected) move(selected, sq);
    }

    const squareStyles: Record<string, CSSProperties> = {};
    if (attempt.lastMove) {
        squareStyles[attempt.lastMove.from] = { backgroundColor: "rgba(255, 255, 0, .35)" };
        squareStyles[attempt.lastMove.to] = { backgroundColor: attempt.status === "wrong" ? "rgba(239, 68, 68, .6)" : "rgba(255, 255, 0, .55)" };
    }
    if (selected) {
        squareStyles[selected] = { backgroundColor: "rgba(255, 255, 0, .55)" };
        for (const option of game.moves({ square: selected, verbose: true })) {
            squareStyles[option.to] = { backgroundImage: "radial-gradient(circle, rgba(0,0,0,.25) 22%, transparent 24%)" };
        }
    }
    const feedback = attempt.status === "wrong" ? "wrong" : attempt.status === "complete" ? (exerciseCredit(attempt) ? "correct" : "learned") : reviewing ? "walkthrough" : null;
    const buttonClass = "rounded-lg px-4 py-2 font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600";
    const original = new Chess(exercise.fen);
    const first = exercise.moves[0];
    const capturer = original.get(first.slice(0, 2) as Square);
    const target = original.get(first.slice(2, 4) as Square);
    const capturePosition = new Chess(exercise.fen);
    const firstMove = applyExerciseMove(capturePosition, first);
    const safeCapture = exercise.moves.length === 1 && firstMove.captured && !capturePosition.isAttacked(firstMove.to, side === "w" ? "b" : "w");

    return (
        <div className="space-y-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-4 space-y-1">
                <h3 className="font-bold">{t("goalTitle")}</h3>
                <p>{t(`goal_${exercise.theme}`)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t(attempt.status === "step" ? "waitingReply" : attempt.status === "solution" ? "solutionInstructions" : complete ? "reviewInstructions" : attempt.status === "wrong" ? "retryInstructions" : side === "w" ? "whiteToMove" : "blackToMove")}</p>
            </div>
            <div className={`w-full max-w-[560px] aspect-square rounded-lg overflow-hidden border-4 ${attempt.status === "wrong" ? "border-red-500" : complete ? "border-green-500" : "border-gray-700"}`}>
                <Chessboard options={{
                    id: "level-exercise",
                    position: attempt.fen,
                    boardOrientation: side === "w" ? "white" : "black",
                    onSquareClick: ({ square }) => squareClick(square),
                    onPieceDrop: ({ sourceSquare, targetSquare }) => { if (targetSquare) move(sourceSquare, targetSquare); return false; },
                    canDragPiece: ({ piece }) => ready && piece.pieceType[0] === side,
                    allowDragging: ready,
                    squareStyles,
                    arrows: attempt.status === "solution" && nextUci ? [{ startSquare: nextUci.slice(0, 2), endSquare: nextUci.slice(2, 4), color: "#2563eb" }] : [],
                    allowDrawingArrows: false,
                    animationDurationInMs: 150,
                }} />
            </div>
            {feedback && (
                <div role="status" aria-live="polite" className={`rounded-xl p-4 space-y-2 ${attempt.status === "wrong" ? "bg-red-50 dark:bg-red-950/50" : "bg-green-50 dark:bg-green-950/50"}`}>
                    <p className="font-bold">{t(feedback)}</p>
                    <p>{t(`explain_${exercise.theme}`)}</p>
                    {complete && exercise.theme === "hangingPiece" && safeCapture && capturer && target && (
                        <p>{t("captureExplanation", { piece: t(`piece_${capturer.type}`), target: t(`piece_${target.type}`), from: first.slice(0, 2), to: first.slice(2, 4) })}</p>
                    )}
                    {attempt.status === "solution" && nextUci && <p className="font-semibold">{t("solutionMove", { move: nextSan, from: nextUci.slice(0, 2), to: nextUci.slice(2, 4) })}</p>}
                    {(attempt.assisted || attempt.mistakes > 0) && <p className="text-sm">{t("assistedNotice")}</p>}
                </div>
            )}
            {attempt.played.length > 0 && <p className="text-sm text-gray-600 dark:text-gray-300">{t("playedMoves", { moves: attempt.played.join(" · ") })}</p>}
            <div className="flex flex-wrap gap-2">
                {(attempt.status === "wrong" || complete || reviewing) && <button type="button" className={buttonClass} onClick={() => { setAttempt(previous => retryExercise(exercise, previous)); setSelected(null); }}>{t("retry")}</button>}
                {!reviewing && !complete && <button type="button" className={buttonClass} onClick={() => { setAttempt(previous => showExerciseSolution(exercise, previous)); setSelected(null); }}>{t("showSolution")}</button>}
                {attempt.status === "solution" && <button type="button" className={buttonClass} onClick={() => setAttempt(previous => nextExerciseMove(exercise, previous))}>{t("nextSolutionMove")}</button>}
                {complete && <button type="button" className="rounded-lg px-4 py-2 font-bold bg-green-600 text-white hover:bg-green-700" onClick={() => { if (!advanced.current) { advanced.current = true; onContinue(exerciseCredit(attempt)); } }}>{t(last ? "finishTest" : "nextExercise")}</button>}
            </div>
        </div>
    );
}
