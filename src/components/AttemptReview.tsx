"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLocale, useTranslations } from "next-intl";
import { describeMove, type MoveError } from "@/lib/attemptMoves";
import { learningMove } from "@/lib/puzzleLearning";

export interface ReviewAttempt {
    id: string;
    student: string;
    at: string;
    success: boolean;
    errors: MoveError[] | null;
    usedHints?: boolean;
    answer?: { played: string; expected: string };
}

export default function AttemptReview({ fen, moves = [], attempts, title, orientation, focusId }: {
    fen: string; moves?: string[]; attempts: ReviewAttempt[]; title: string;
    orientation?: "white" | "black"; focusId?: string;
}) {
    const t = useTranslations("AttemptReview");
    const locale = useLocale();
    const firstError = focusId ? attempts.find(attempt => attempt.id === focusId && attempt.errors?.length) : attempts.find(attempt => attempt.errors?.length);
    const [selection, setSelection] = useState<{ id: string; index: number } | null>(firstError ? { id: firstError.id, index: 0 } : null);
    const [view, setView] = useState<"before" | "played" | "expected">("before");
    const [step, setStep] = useState(0);
    const selectedAttempt = attempts.find(attempt => attempt.id === selection?.id);
    const error = selectedAttempt?.errors?.[selection?.index ?? 0];
    const played = error ? describeMove(error.fen, error.played) : null;
    const expected = error?.expected.map(move => describeMove(error.fen, move)).filter(move => move !== null) ?? [];
    const game = new Chess(fen);
    const line: string[] = [];
    for (const move of moves.slice(0, step)) {
        try { line.push(learningMove(game, move).san); } catch { break; }
    }
    const position = error ? view === "played" ? played?.fen ?? error.fen : view === "expected" ? expected[0]?.fen ?? error.fen : error.fen : game.fen();
    const arrows = error && view === "before" ? [
        ...(played ? [{ startSquare: played.from, endSquare: played.to, color: "#dc2626" }] : []),
        ...expected.map(move => ({ startSquare: move.from, endSquare: move.to, color: "#16a34a" })),
    ] : [];
    const button = "rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40";
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" });
    return <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 space-y-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 lg:sticky lg:top-4 self-start">
                <div className="mx-auto max-w-[520px] aspect-square"><Chessboard options={{ id: "attempt-review", position,
                    boardOrientation: orientation ?? (new Chess(fen).turn() === "w" ? "white" : "black"),
                    allowDragging: false, allowDrawingArrows: false, arrows, animationDurationInMs: 200 }} /></div>
                {error ? <div className="space-y-3" aria-live="polite">
                    <p className="font-bold">{selectedAttempt?.student} · <span className="text-red-600 dark:text-red-400">{t("played", { move: played?.label ?? error.played })}</span></p>
                    <p className="text-green-700 dark:text-green-400">{t("expected", { moves: expected.map(move => move.label).join(", ") })}</p>
                    <div className="flex flex-wrap gap-2">{(["before", "played", "expected"] as const).map(mode => <button key={mode} type="button" className={button} aria-pressed={view === mode} onClick={() => setView(mode)}>{t(`show_${mode}`)}</button>)}</div>
                </div> : <p aria-live="polite" className="text-sm font-mono">{t("solutionStep", { current: step, total: moves.length })}{line.length ? ` · ${line.join(" ")}` : ""}</p>}
                {moves.length > 0 && <div className="flex flex-wrap gap-2">
                    <button type="button" className={button} disabled={!error && step === 0} onClick={() => { setSelection(null); setStep(value => Math.max(0, value - 1)); }}>{t("previous")}</button>
                    <button type="button" className={button} disabled={!error && step === moves.length} onClick={() => { setSelection(null); setStep(value => Math.min(moves.length, value + 1)); }}>{t("next")}</button>
                    <button type="button" className={button} onClick={() => { setSelection(null); setStep(0); }}>{t("solution")}</button>
                </div>}
            </div>
            <div className="space-y-3">
                {attempts.length === 0 && <p className="text-sm text-gray-500">{t("noMistakes")}</p>}
                {attempts.map(attempt => <article key={attempt.id} className={`rounded-xl border p-3 space-y-2 ${attempt.id === focusId ? "border-blue-500" : "border-gray-200 dark:border-gray-700"}`}>
                    <div className="flex flex-wrap justify-between gap-2"><span className="font-bold">{attempt.student}</span><time className="text-xs text-gray-500" dateTime={attempt.at}>{date.format(new Date(attempt.at))}</time></div>
                    <p className="text-sm">{t(attempt.success ? "solved" : "unsolved")}{attempt.usedHints ? ` · ${t("assisted")}` : ""}</p>
                    {attempt.answer && <div className="text-sm space-y-1"><p className={attempt.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{t("played", { move: attempt.answer.played })}</p><p>{t("expected", { moves: attempt.answer.expected })}</p></div>}
                    {attempt.errors === null ? <p className="text-sm text-gray-500">{t("legacy")}</p> : !attempt.errors.length ? !attempt.answer && <p className="text-sm text-gray-500">{t("noWrongMoves")}</p> : <ol className="flex flex-wrap gap-2">
                        {attempt.errors.map((mistake, index) => <li key={index}><button type="button" className={`${button} text-red-700 dark:text-red-400`} aria-pressed={selection?.id === attempt.id && selection.index === index}
                            onClick={() => { setSelection({ id: attempt.id, index }); setView("before"); }}>{index + 1}. {describeMove(mistake.fen, mistake.played)?.label ?? mistake.played}</button></li>)}
                    </ol>}
                </article>)}
            </div>
        </div>
    </section>;
}
