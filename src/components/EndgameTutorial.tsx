"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { ENDGAME_LESSONS } from "@/lib/endgameLessons";
import type { EndgameId } from "@/lib/endgameTraining";
import { learningMove } from "@/lib/puzzleLearning";
import ReadAloud from "./ReadAloud";

export default function EndgameTutorial({ id, onPractice }: { id: EndgameId; onPractice: () => void }) {
    const tLesson = useTranslations("EndgameLessons");
    const tTraining = useTranslations("Training");
    const [index, setIndex] = useState(0);
    const [ply, setPly] = useState(0);
    const steps = ENDGAME_LESSONS[id], step = steps[index];
    const game = new Chess(step.fen);
    const played = step.moves.slice(0, ply).map(move => learningMove(game, move));
    const last = played.at(-1);
    const text = tLesson(`${id}.${step.id}.${ply > 0 && ply === step.moves.length ? "after" : "explain"}`);
    const styles: Record<string, React.CSSProperties> = Object.fromEntries(step.focus.map(square => [square, { backgroundColor: "rgba(14,165,233,.35)" }]));
    if (last) { styles[last.from] = { backgroundColor: "rgba(250,204,21,.45)" }; styles[last.to] = { backgroundColor: "rgba(250,204,21,.7)" }; }
    function go(next: number) { setIndex(next); setPly(0); }
    return <section className="space-y-4" aria-label={tLesson("tutorial")}>
        <div className="rounded-xl bg-indigo-50 text-indigo-950 p-4 space-y-2"><p className="font-bold">{tLesson("step", { current: index + 1, total: steps.length })}</p><h2 className="text-xl font-bold">{tLesson(`${id}.${step.id}.title`)}</h2><p>{text}</p><ReadAloud text={text} /></div>
        <div className="max-w-[560px] aspect-square mx-auto"><Chessboard options={{ id: "endgame-tutorial", position: game.fen(), allowDragging: false, allowDrawingArrows: false, boardOrientation: "white", squareStyles: styles, arrows: last ? [{ startSquare: last.from, endSquare: last.to, color: "#4f46e5" }] : [], animationDurationInMs: 250 }} /></div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{tLesson("legend")}</p>
        {step.moves.length > 0 && <div className="space-y-2"><p aria-live="polite">{tTraining("lineStep", { current: ply, total: step.moves.length })}{played.length ? ` · ${played.map(move => move.san).join(" · ")}` : ""}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={ply === 0} onClick={() => setPly(value => value - 1)} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 disabled:opacity-40">{tTraining("previous")}</button><button type="button" disabled={ply === step.moves.length} onClick={() => setPly(value => value + 1)} className="rounded-lg bg-indigo-600 text-white px-4 py-2 disabled:opacity-40">{tLesson("showMove")}</button></div></div>}
        <div className="rounded-xl bg-amber-50 text-amber-950 p-4 space-y-2"><h3 className="font-bold">{tLesson("avoid")}</h3><p>{tLesson(`${id}.trap`)}</p></div>
        <div className="rounded-xl border border-indigo-200 p-4 space-y-2"><h3 className="font-bold">{tLesson("checklist")}</h3><ol className="list-decimal pl-5 space-y-1">{[1, 2, 3].map(number => <li key={number}>{tLesson(`${id}.check${number}`)}</li>)}</ol></div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-3 disabled:opacity-40">{tLesson("previousStep")}</button>{index + 1 < steps.length && <button type="button" onClick={() => go(index + 1)} className="rounded-lg bg-indigo-600 text-white px-4 py-3">{tLesson("nextStep")}</button>}<button type="button" onClick={onPractice} className="rounded-lg bg-green-700 text-white px-4 py-3 font-bold">{tLesson("practice")}</button></div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{tLesson("examples")}</p>
    </section>;
}
