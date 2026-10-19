"use client";

import { useTranslations } from "next-intl";
import type { EndgameId } from "@/lib/endgameTraining";
import type { EndgameAdvice } from "@/lib/endgameTablebase";
import { endgameHintContext } from "@/lib/endgameHints";

export default function EndgameHint({ id, fen, advice, stage }: { id: EndgameId; fen: string; advice: EndgameAdvice; stage: number }) {
    const tHint = useTranslations("EndgameHints");
    const tHelp = useTranslations("LearningHelp");
    const context = endgameHintContext(id, fen, advice.move);
    if (!context) return null;
    const values = { ...context.values, piece: tHelp(`piece_${context.piece}`), color: context.color ? tHint(context.color) : "" };
    const cannotForceGoal = id === "holdDraw" ? advice.category === "loss" || advice.category === "blessed-loss" : advice.category === "draw" || advice.category === "loss" || advice.category === "blessed-loss" || advice.category === "cursed-win";
    return <aside role="status" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 text-amber-950 p-4 space-y-3">
        <h3 className="font-bold">{tHelp("hintStage", { stage })}</h3>
        {cannotForceGoal && <p className="font-semibold">{tHint(id === "holdDraw" ? "cannotDraw" : "cannotWin")}</p>}
        <p>{tHint(`plan_${context.plan}`, values)}</p>
        {stage >= 2 && <><p className="font-semibold">{tHelp("pieceClue", { piece: values.piece, square: values.from })}</p><p>{tHint(`reason_${context.reason}`, values)}</p></>}
        {stage >= 3 && <><p className="font-bold">{tHelp("moveClue", { move: values.move })}</p><p>{tHint(`effect_${context.reason}`, values)}</p>{context.covered.length > 0 && <p>{tHint("covered", values)}</p>}</>}
        {context.focus.length > 0 && <p className="text-sm">{tHint("focus")}</p>}
        <p className="text-sm">{tHelp("assisted")}</p>
    </aside>;
}
