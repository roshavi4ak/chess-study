"use client";

import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { consequencePosition } from "@/lib/puzzleLearning";
import LichessAnalysisLink from "./LichessAnalysisLink";

// Each exploration owns its worker. Closing it cancels analysis and stale replies.
export default function MoveConsequence({ fen, move }: { fen: string; move: string }) {
    const t = useTranslations("LearningHelp");
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<ReturnType<typeof consequencePosition> | null>(null);
    const [failed, setFailed] = useState(false);
    const [showReply, setShowReply] = useState(false);
    useEffect(() => {
        if (!open) return;
        let worker: Worker | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;
        const stop = () => { if (timer) clearTimeout(timer); if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); } };
        try {
            const position = consequencePosition(fen, move);
            if (new Chess(position.afterMove).isGameOver()) {
                // No invented reply in a terminal position.
                return;
            }
            worker = new Worker("/stockfish.js");
            timer = setTimeout(() => { stop(); if (!cancelled) setFailed(true); }, 6000);
            worker.onerror = () => { stop(); if (!cancelled) setFailed(true); };
            worker.onmessage = event => {
                if (typeof event.data !== "string" || !event.data.startsWith("bestmove ")) return;
                try {
                    const next = consequencePosition(fen, move, event.data.split(" ")[1]);
                    if (!cancelled) setResult(next);
                } catch { if (!cancelled) setFailed(true); }
                stop();
            };
            worker.postMessage("uci");
            worker.postMessage(`position fen ${position.afterMove}`);
            worker.postMessage("go depth 8");
        } catch { queueMicrotask(() => { if (!cancelled) setFailed(true); }); }
        return () => { cancelled = true; stop(); };
    }, [open, fen, move]);

    const initial = consequencePosition(fen, move);
    const terminal = new Chess(initial.afterMove).isGameOver();
    if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-blue-100 px-4 py-2 font-semibold text-blue-950">{t("explore")}</button>;
    const position = result ?? initial;
    const orientation = new Chess(fen).turn() === "w" ? "white" : "black";
    return <section className="rounded-xl border border-blue-200 p-4 space-y-3 text-left">
        <div className="flex justify-between gap-2"><h3 className="font-bold">{t("explore")}</h3><button type="button" onClick={() => { setOpen(false); setResult(null); setFailed(false); setShowReply(false); }}>{t("close")}</button></div>
        <p>{t("yourMove", { move: position.move })}</p>
        <div className="w-full max-w-[360px] aspect-square mx-auto"><Chessboard options={{ id: "consequence", position: showReply ? position.afterReply : position.afterMove, boardOrientation: orientation, allowDragging: false, allowDrawingArrows: false, animationDurationInMs: 250 }} /></div>
        {!result && !terminal && !failed && <p role="status">{t("analysing")}</p>}
        {terminal && <p>{t("terminal")}</p>}
        {failed && <p role="status">{t("unavailable")}</p>}
        {result && <>
            <button type="button" onClick={() => setShowReply(value => !value)} className="rounded-lg bg-blue-600 text-white px-4 py-2">{t(showReply ? "backToMove" : "showReply")}</button>
            {showReply && <p role="status">{t(result.reason, { move: result.reply ?? "", piece: result.captured ? t(`piece_${result.captured}`) : "" })}</p>}
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("exploreNotice")}</p>
        </>}
        <LichessAnalysisLink fen={position.afterMove} orientation={orientation} />
    </section>;
}
