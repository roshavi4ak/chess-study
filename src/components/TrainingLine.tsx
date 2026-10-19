"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { learningMove } from "@/lib/puzzleLearning";

export default function TrainingLine({ fen, moves, label, orientation = "white" }: { fen: string; moves: readonly string[]; label: string; orientation?: "white" | "black" }) {
    const t = useTranslations("Training");
    const [index, setIndex] = useState(0);
    const game = new Chess(fen);
    const played = moves.slice(0, index).map(move => learningMove(game, move).san);
    return <section className="rounded-xl border border-indigo-200 p-3 space-y-3">
        <h3 className="font-bold">{label}</h3>
        <div className="max-w-[360px] mx-auto aspect-square"><Chessboard options={{ id: "training-line", position: game.fen(), allowDragging: false, allowDrawingArrows: false, boardOrientation: orientation, animationDurationInMs: 250 }} /></div>
        <p aria-live="polite">{t("lineStep", { current: index, total: moves.length })}{played.length ? ` · ${played.join(" · ")}` : ""}</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={index === 0} onClick={() => setIndex(value => value - 1)} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-2 disabled:opacity-40">{t("previous")}</button><button type="button" disabled={index === moves.length} onClick={() => setIndex(value => value + 1)} className="rounded-lg bg-indigo-600 text-white px-3 py-2 disabled:opacity-40">{t("next")}</button></div>
    </section>;
}
