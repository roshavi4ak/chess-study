"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { Delete } from "lucide-react";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import type { ExerciseReview } from "@/lib/attemptMoves";
import {
    NOTATION_ROUND, PIECE_LETTERS, checkWrittenAnswer, makeNotationQuestion, playedRight,
    type AnswerCheck, type NotationDirection, type NotationLevel, type NotationQuestion,
} from "@/lib/notationTrainer";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const PROMOTIONS = ["q", "r", "b", "n"] as const;

// Ten questions: write down the move shown by the arrow, or play the move written in notation.
export default function NotationRound({ direction, level, onFinish }: {
    direction: NotationDirection;
    level: NotationLevel;
    onFinish: (correct: number, reviews?: ExerciseReview[]) => void;
}) {
    const t = useTranslations("Notation");
    const [index, setIndex] = useState(0);
    const [question, setQuestion] = useState<NotationQuestion | null>(null);
    const [results, setResults] = useState<boolean[]>([]);
    const [answer, setAnswer] = useState("");
    const [feedback, setFeedback] = useState<AnswerCheck | null>(null);
    const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const reviews = useRef<ExerciseReview[]>([]);

    useEffect(() => {
        // Level 3 and 4 positions take a moment to find; let the page paint first.
        const timer = setTimeout(() => setQuestion(makeNotationQuestion(level)), 0);
        return () => clearTimeout(timer);
    }, [level, index]);

    const game = useMemo(() => new Chess(question?.fen), [question]);
    const toMove = game.turn() === "w" ? "white" : "black";
    const answered = feedback !== null;
    const playedCorrectly = direction === "play" && answered && feedback !== "wrong";
    // After a right answer the board shows the move made, not the position before it.
    const playedFen = useMemo(() => {
        if (!question) return undefined;
        const after = new Chess(question.fen);
        after.move(question.san);
        return after.fen();
    }, [question]);

    function finishQuestion(result: AnswerCheck, played?: string) {
        if (question) reviews.current.push({ fen: question.fen, moves: [question.from + question.to + (question.promotion ?? "")], success: result !== "wrong", errors: [],
            answer: { played: played ?? answer, expected: question.san } });
        setFeedback(result);
        setResults(previous => [...previous, result !== "wrong"]);
    }

    function submitWritten(event?: React.FormEvent) {
        event?.preventDefault();
        if (!question || answered || !answer.trim()) return;
        finishQuestion(checkWrittenAnswer(answer, question.san));
    }

    function judgeMove(move: { from: string; to: string; promotion?: string }) {
        if (!question || answered) return false;
        const played = new Chess(question.fen).move({ ...move, promotion: move.promotion ?? "q" });
        finishQuestion(playedRight(question, move) ? "exact" : "wrong", played.san);
        return true;
    }

    const { onSquareClick, onPieceClick, onPieceDrop, optionSquares } = useLegalMoves({
        game,
        onMove: move => {
            if (!question || answered || direction !== "play") return false;
            if (!game.moves({ verbose: true }).some(option => option.from === move.from && option.to === move.to)) return false;
            if (move.promotion) {
                setPendingPromotion({ from: move.from, to: move.to });
                return true;
            }
            return judgeMove(move);
        },
    });

    function next() {
        if (index + 1 >= NOTATION_ROUND) {
            onFinish(results.filter(Boolean).length, reviews.current);
            return;
        }
        setQuestion(null);
        setAnswer("");
        setFeedback(null);
        setPendingPromotion(null);
        setIndex(index + 1);
        setTimeout(() => inputRef.current?.focus(), 50);
    }

    const type = (text: string) => !answered && setAnswer(previous => previous + text);
    const shownSan = question?.san ?? "";
    const sideName = toMove === "white" ? t("white") : t("black");

    const arrows = question && (direction === "write" || (answered && feedback === "wrong"))
        ? [{ startSquare: question.from, endSquare: question.to, color: answered && feedback !== "wrong" ? "#16a34a" : "#2563eb" }]
        : [];

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {direction === "write" ? t("writePrompt", { side: sideName }) : t("playPrompt", { side: sideName })}
                </p>
                <div className="flex gap-1" aria-label={t("progress", { done: results.length, count: NOTATION_ROUND })}>
                    {Array.from({ length: NOTATION_ROUND }, (_, position) => (
                        <span key={position} className={`h-3 w-3 rounded-full ${position < results.length ? (results[position] ? "bg-green-500" : "bg-red-400") : "bg-gray-300 dark:bg-gray-600"}`} />
                    ))}
                </div>
            </div>

            {direction === "play" && question && (
                <p className="text-5xl font-black text-center tracking-wide text-gray-900 dark:text-white" aria-live="polite">{shownSan}</p>
            )}

            <div className="w-full max-w-[520px] aspect-square">
                {question ? (
                    <Chessboard
                        options={{
                            id: "notation-board",
                            position: playedCorrectly ? playedFen : question.fen,
                            boardOrientation: toMove,
                            allowDragging: direction === "play" && !answered && !pendingPromotion,
                            allowDrawingArrows: false,
                            onSquareClick: args => { if (direction === "play" && !answered && !pendingPromotion) void onSquareClick(args); },
                            onPieceClick: args => { if (direction === "play" && !answered && !pendingPromotion) onPieceClick(args); },
                            onPieceDrop: args => { if (direction === "play" && !answered && !pendingPromotion) void onPieceDrop(args); return false; },
                            squareStyles: playedCorrectly
                                ? { [question.from]: { backgroundColor: "rgba(34, 197, 94, 0.4)" }, [question.to]: { backgroundColor: "rgba(34, 197, 94, 0.4)" } }
                                : direction === "play" ? optionSquares : { [question.from]: { backgroundColor: "rgba(250, 204, 21, 0.45)" }, [question.to]: { backgroundColor: "rgba(250, 204, 21, 0.45)" } },
                            arrows,
                        }}
                    />
                ) : (
                    <div className="w-full h-full rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" />
                )}
            </div>

            {pendingPromotion && !answered && (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("choosePromotion")}>
                    <span className="font-medium">{t("choosePromotion")}</span>
                    {PROMOTIONS.map(piece => (
                        <button key={piece} type="button" onClick={() => judgeMove({ ...pendingPromotion, promotion: piece })}
                            className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 text-xl font-bold">
                            {piece.toUpperCase()}
                        </button>
                    ))}
                </div>
            )}

            {direction === "write" && question && (
                <form onSubmit={submitWritten} className="space-y-2">
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            value={answer}
                            onChange={event => !answered && setAnswer(event.target.value)}
                            readOnly={answered}
                            autoFocus
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            aria-label={t("yourAnswer")}
                            placeholder={t("answerPlaceholder")}
                            className="flex-1 min-w-0 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-2xl font-mono"
                        />
                        <button type="submit" disabled={answered || !answer.trim()} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50">{t("check")}</button>
                    </div>
                    {!answered && (
                        <div className="space-y-1.5" aria-label={t("keypad")}>
                            {[PIECE_LETTERS, FILES, RANKS].map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-8 gap-1.5 max-w-md">
                                    {row.map(key => (
                                        <button key={key} type="button" onClick={() => type(key)} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-700 font-mono text-lg font-bold">{key}</button>
                                    ))}
                                </div>
                            ))}
                            <div className="flex flex-wrap gap-1.5">
                                {["x", "+", "#", "=", "O-O", "O-O-O"].map(key => (
                                    <button key={key} type="button" onClick={() => type(key)} className="min-w-10 h-10 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 font-mono text-lg font-bold">{key}</button>
                                ))}
                                <button type="button" onClick={() => setAnswer(previous => previous.slice(0, -1))} aria-label={t("backspace")} className="min-w-10 h-10 px-2 rounded-lg bg-red-50 dark:bg-red-900/30">
                                    <Delete className="h-5 w-5 mx-auto" />
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            )}

            {answered && question && (
                <div className={`rounded-xl p-4 space-y-2 ${feedback === "wrong" ? "bg-red-50 dark:bg-red-900/30" : "bg-green-50 dark:bg-green-900/30"}`} role="status">
                    <p className="font-bold text-lg">
                        {feedback === "exact" && `✅ ${t("correct")}`}
                        {feedback === "markOff" && `✅ ${t("correctMark", { san: shownSan })}`}
                        {feedback === "wrong" && `❌ ${t("wrong", { san: shownSan })}`}
                    </p>
                    {feedback === "wrong" && direction === "play" && <p className="text-sm">{t("wrongPlay")}</p>}
                    <button type="button" onClick={next} autoFocus className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold">
                        {index + 1 >= NOTATION_ROUND ? t("seeResult") : t("next")} →
                    </button>
                </div>
            )}
        </div>
    );
}
