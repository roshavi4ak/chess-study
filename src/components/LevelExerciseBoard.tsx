"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { applyExerciseMove, attemptExerciseMove, exerciseCredit, nextExerciseMove, retryExercise, showExerciseSolution, startExercise, type LevelExercise } from "@/lib/levelExercises";
import ProgressiveHint from "./ProgressiveHint";
import MoveConsequence from "./MoveConsequence";
import { attemptedUci } from "@/lib/puzzleLearning";
import { useLearningAttempt } from "@/hooks/useLearningAttempt";
import { useActivityChessnut } from "@/hooks/useActivityChessnut";
import ActivityBoardPanel from "./ActivityBoardPanel";
import type { ExerciseReview, MoveError } from "@/lib/attemptMoves";

// After a correct move the opponent replies on its own, as in the puzzle boards.
const REPLY_DELAY_MS = 350;

// Learning feedback is deliberately separate from the timed, one-try boards.
export default function LevelExerciseBoard({ exercise, onContinue, last }: { exercise: LevelExercise; onContinue: (unassisted: boolean, review?: ExerciseReview) => void; last: boolean }) {
    const t = useTranslations("LevelExercises");
    const tHelp = useTranslations("LearningHelp");
    const submission = useLearningAttempt(exercise.puzzleId);
    const [attempt, setAttempt] = useState(() => startExercise(exercise));
    const [selected, setSelected] = useState<Square | null>(null);
    const [hintStage, setHintStage] = useState(0);
    const [wrongPosition, setWrongPosition] = useState<{ fen: string; move: string } | null>(null);
    const advanced = useRef(false);
    const moveErrors = useRef<MoveError[]>([]);
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

    function move(from: string, to: string, promotion?: string, physical = false) {
        if ((board.enabled && !physical) || !ready || from === to) return false;
        const next = attemptExerciseMove(exercise, attempt, { from, to, promotion });
        if (next.status === "wrong") {
            const uci = attemptedUci(attempt.fen, from, to, promotion);
            if (uci) {
                moveErrors.current.push({ ply: attempt.index, fen: attempt.fen, played: uci, expected: [exercise.moves[attempt.index]] });
                setWrongPosition({ fen: attempt.fen, move: uci });
            }
            submission.record(false, false, moveErrors.current.map(error => ({ ...error, ply: error.ply + 1 })));
        } else {
            setHintStage(0); setWrongPosition(null);
        }
        setAttempt(next);
        setSelected(null);
        return next.status !== "wrong";
    }

    function squareClick(square: string) {
        if (board.enabled || !ready) return;
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
    if (hintStage >= 2 && nextUci && !complete) squareStyles[nextUci.slice(0, 2)] = { backgroundColor: "rgba(250,204,21,.65)" };
    const feedback = attempt.status === "wrong" ? "wrong" : attempt.status === "complete" ? (exerciseCredit(attempt) ? "correct" : "learned") : reviewing ? "walkthrough" : null;
    const buttonClass = "rounded-lg px-4 py-2 font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600";
    const original = new Chess(exercise.fen);
    const first = exercise.moves[0];
    const capturer = original.get(first.slice(0, 2) as Square);
    const target = original.get(first.slice(2, 4) as Square);
    const capturePosition = new Chess(exercise.fen);
    const firstMove = applyExerciseMove(capturePosition, first);
    const safeCapture = exercise.moves.length === 1 && firstMove.captured && !capturePosition.isAttacked(firstMove.to, side === "w" ? "b" : "w");
    const board = useActivityChessnut({
        fen: attempt.fen, canMove: ready, expectedMoves: nextUci ? [nextUci] : [],
        onMove: input => move(input.from, input.to, input.promotion, true),
        hintMove: !complete && (hintStage >= 3 || attempt.mistakes >= 2) ? nextUci : undefined,
        completion: complete ? exercise.id : undefined,
        guideSquares: attempt.status === "solution" && nextUci ? [nextUci.slice(0, 2), nextUci.slice(2, 4)] : [],
    });
    useEffect(() => {
        if (attempt.status === "complete" && board.ready) submission.record(exerciseCredit(attempt), attempt.assisted);
        if (board.enabled && board.ready && attempt.status === "wrong") {
            const timer = setTimeout(() => setAttempt(previous => ({ ...previous, status: "playing" })), 0);
            return () => clearTimeout(timer);
        }
    }, [attempt, board.ready, board.enabled, submission]);

    return (
        <div className="space-y-3">
            <ActivityBoardPanel board={board} />
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
                    canDragPiece: ({ piece }) => !board.enabled && ready && piece.pieceType[0] === side,
                    allowDragging: ready && !board.enabled,
                    squareStyles,
                    arrows: (attempt.status === "solution" || hintStage >= 3) && nextUci ? [{ startSquare: nextUci.slice(0, 2), endSquare: nextUci.slice(2, 4), color: "#2563eb" }] : [],
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
            {!complete && !reviewing && nextUci && <ProgressiveHint fen={attempt.fen} move={nextUci} stage={hintStage} />}
            {wrongPosition && <MoveConsequence key={`${wrongPosition.fen}-${wrongPosition.move}`} {...wrongPosition} />}
            <div className="flex flex-wrap gap-2">
                {(attempt.status === "wrong" || complete || reviewing) && <button type="button" className={buttonClass} onClick={() => { setAttempt(previous => retryExercise(exercise, previous)); setSelected(null); setHintStage(0); setWrongPosition(null); }}>{t("retry")}</button>}
                {!reviewing && !complete && hintStage < 3 && attempt.status !== "step" && <button type="button" className={buttonClass} onClick={() => { submission.record(false, true); setHintStage(value => value + 1); setAttempt(previous => ({ ...previous, assisted: true, status: "playing" })); }}>{tHelp(hintStage ? "moreHelp" : "hint")}</button>}
                {!reviewing && !complete && hintStage >= 3 && <button type="button" className={buttonClass} onClick={() => { submission.record(false, true); setAttempt(previous => showExerciseSolution(exercise, previous)); setSelected(null); setHintStage(0); }}>{t("showSolution")}</button>}
                {attempt.status === "solution" && <button type="button" disabled={!board.ready} className={buttonClass} onClick={() => setAttempt(previous => nextExerciseMove(exercise, previous))}>{t("nextSolutionMove")}</button>}
                {complete && <button type="button" disabled={submission.saving || submission.error || !board.ready} className="rounded-lg px-4 py-2 font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50" onClick={() => { if (!advanced.current) { advanced.current = true; onContinue(exerciseCredit(attempt), { fen: exercise.fen, moves: exercise.moves, errors: [...moveErrors.current], success: exerciseCredit(attempt) }); } }}>{t(last ? "finishTest" : "nextExercise")}</button>}
            </div>
            {submission.saving && <p role="status">{tHelp("saving")}</p>}
            {submission.error && <div role="alert" className="space-y-2"><p>{tHelp("saveError")}</p><button type="button" disabled={submission.saving} onClick={() => void submission.retry()} className="underline">{tHelp("retrySave")}</button></div>}
        </div>
    );
}
