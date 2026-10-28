"use client";

import { useTranslations } from "next-intl";
import type { useChessnutBoard } from "@/hooks/useChessnutBoard";

interface Props {
    board: ReturnType<typeof useChessnutBoard>;
    reply?: string;
    onConnect(): void;
    onScreen(): void;
    activity?: boolean;
}

export default function ChessnutBoardPanel({ board, reply, onConnect, onScreen, activity = false }: Props) {
    const t = useTranslations("Chessnut");
    const connected = board.status === "connected";
    return (
        <section aria-label={t("title")} className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">{t("title")}</h2>
                <span className="text-sm">{connected ? board.name : t(board.status)}</span>
            </div>
            <p className="text-sm" role="status" aria-live="polite">
                {board.available === false ? t("unsupported") : connected
                    ? !board.position ? t("waiting")
                        : board.positionStatus === "opponent" && reply ? t("opponentMove", { move: reply })
                            : board.positionStatus === "hint" && board.hintMove ? t("hintMove", { move: `${board.hintMove.slice(0, 2)} → ${board.hintMove.slice(2, 4)}${board.hintMove[4] ? ` = ${board.hintMove[4].toUpperCase()}` : ""}` })
                            : t(board.positionStatus === "complete" && activity ? "activityComplete" : board.positionStatus)
                    : board.enabled ? t("reconnectHelp") : t(activity ? "activityIntro" : "intro")}
            </p>
            {board.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(board.error === "connect" ? "connectError" : "communicationError")}</p>}
            <div className="flex flex-wrap gap-2">
                {!connected && <button type="button" onClick={onConnect} disabled={board.available !== true || board.status === "connecting"} className="rounded-lg bg-blue-700 px-4 py-2 text-white font-medium disabled:opacity-50">{t(board.enabled ? "reconnect" : "connect")}</button>}
                {connected && <>
                    <button type="button" onClick={() => board.disconnect()} className="rounded-lg border border-blue-300 px-3 py-2 text-sm dark:border-blue-700">{t("disconnect")}</button>
                </>}
                {board.enabled && <button type="button" onClick={onScreen} className="rounded-lg border border-blue-300 px-3 py-2 text-sm dark:border-blue-700">{t("useScreen")}</button>}
            </div>
            {connected && <details className="text-sm">
                <summary className="cursor-pointer py-1 font-medium">{t("moreControls")}</summary>
                <div className="mt-2 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={board.testLights} className="rounded-lg border border-blue-300 px-3 py-2 text-sm dark:border-blue-700">{t("testLights")}</button>
                        <button type="button" onClick={board.refresh} className="rounded-lg border border-blue-300 px-3 py-2 text-sm dark:border-blue-700">{t("refresh")}</button>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t(activity ? "activityHelp" : "physicalHelp")}</p>
                </div>
            </details>}
        </section>
    );
}
