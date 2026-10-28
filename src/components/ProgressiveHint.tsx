"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { moveClue } from "@/lib/puzzleLearning";

export default function ProgressiveHint({ fen, move, stage, note }: { fen: string; move: string; stage: number; note?: string }) {
    const t = useTranslations("LearningHelp");
    // Classifying a quiet move scans the board, so do it once per position rather than on every render.
    const active = stage > 0;
    const clue = useMemo(() => active ? moveClue(fen, move) : null, [fen, move, active]);
    if (!stage || !clue) return null;
    return <div role="status" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 space-y-2">
        <p className="font-bold">{t("hintStage", { stage })}</p>
        <p>{t(clue.clue)}</p>
        {stage >= 3 && note && <p>{note}</p>}
        {stage >= 2 && <p>{t("pieceClue", { piece: t(`piece_${clue.piece}`), square: clue.from })}</p>}
        {stage >= 3 && <p className="font-semibold">{t("moveClue", { move: clue.san })}</p>}
        <p className="text-sm">{t("assisted")}</p>
    </div>;
}
