"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getBotWins, recordPlaySession } from "@/app/actions/play";
import { BOTS, botKey, unlockedBots, type BotProfile } from "@/lib/bots";
import { getAvatarPath } from "@/lib/avatars";
import BotGame, { type BotGameResult } from "@/components/BotGame";

export default function BotsPage() {
    const t = useTranslations("Bots");
    const tCoach = useTranslations("BotTeaching");
    const [wins, setWins] = useState<Record<string, number>>({});
    const [bot, setBot] = useState<BotProfile | null>(null);
    const [childColor, setChildColor] = useState<"w" | "b">("w");
    const [round, setRound] = useState(0);
    const [finished, setFinished] = useState<BotGameResult | null>(null);
    const [teaching, setTeaching] = useState(true);

    useEffect(() => {
        getBotWins().then(loaded => {
            setWins(loaded);
            const requested = new URLSearchParams(window.location.search).get("bot");
            const chosen = BOTS.find(entry => entry.id === requested);
            const available = unlockedBots(new Set(Object.keys(loaded).filter(id => loaded[id] > 0)));
            // A collectible being locked must never bypass the opponent ladder.
            if (chosen && available.has(chosen.id)) { setBot(chosen); setRound(1); }
        }).catch(() => undefined);
    }, []);

    const beaten = new Set(Object.keys(wins).filter(id => wins[id] > 0));
    const open = unlockedBots(beaten);

    function play(next: BotProfile) {
        setBot(next);
        setFinished(null);
        setRound(round + 1);
    }

    function onFinish(result: BotGameResult, moves: number, usedTeaching: boolean) {
        if (!bot) return;
        setFinished(result);
        // Games where nobody moved yet (an instant resign) are not saved.
        if (moves === 0) return;
        recordPlaySession({ kind: "BOT_GAME", key: botKey(bot.id), score: result === "win" ? 1 : 0, won: result === "draw" ? undefined : result === "win", details: { color: childColor, moves, teaching: usedTeaching } })
            .then(() => getBotWins().then(setWins))
            .catch(error => console.error("Failed to save bot game:", error));
    }

    const index = bot ? BOTS.findIndex(entry => entry.id === bot.id) : -1;
    const nextBot = index >= 0 ? BOTS[index + 1] : undefined;

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🐾 {t("title")}</h1>
                {bot ? (
                    <button type="button" onClick={() => setBot(null)} className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToBots")}</button>
                ) : (
                    <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
                )}
            </div>

            {bot ? (
                <div className="space-y-4">
                    <BotGame key={round} bot={bot} childColor={childColor} onFinish={onFinish} initialTeaching={teaching} />
                    {finished && (
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => play(bot)} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">{t("playAgain")}</button>
                            {finished === "win" && nextBot && (
                                <button type="button" onClick={() => play(nextBot)} className="px-4 py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600">
                                    {t("playNext", { name: t(`${nextBot.id}Name`) })} →
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
                    <label className="flex items-center gap-2 rounded-xl bg-indigo-50 text-indigo-950 p-4"><input type="checkbox" checked={teaching} onChange={event => setTeaching(event.target.checked)} /><span><strong>{tCoach("enabled")}</strong> — {tCoach("selectionHelp")}</span></label>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{t("playAs")}</span>
                        {(["w", "b"] as const).map(color => (
                            <button key={color} type="button" onClick={() => setChildColor(color)}
                                className={`px-3 py-1.5 rounded-lg font-medium ${childColor === color ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>
                                {color === "w" ? t("white") : t("black")}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {BOTS.map((entry, position) => {
                            const isOpen = open.has(entry.id);
                            return (
                                <button key={entry.id} type="button" disabled={!isOpen} onClick={() => play(entry)}
                                    className={`relative flex flex-col items-center text-center gap-2 rounded-2xl p-4 border-2 transition ${isOpen ? "bg-white dark:bg-gray-800 border-orange-200 dark:border-orange-900 hover:shadow-lg hover:-translate-y-0.5" : "bg-gray-50 dark:bg-gray-800/50 border-dashed border-gray-300 dark:border-gray-600 opacity-70"}`}>
                                    <span className="absolute top-2 left-3 text-xs font-bold text-gray-400">{position + 1}</span>
                                    <Image src={getAvatarPath(entry.avatar)} alt="" width={80} height={80} className={`h-20 w-20 object-contain ${isOpen ? "" : "grayscale"}`} />
                                    <span className="font-bold text-gray-900 dark:text-white">{t(`${entry.id}Name`)}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 min-h-8">{isOpen ? t(`${entry.id}Intro`) : <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />{t("locked")}</span>}</span>
                                    {wins[entry.id] > 0 && <span className="text-xs font-bold text-green-700 dark:text-green-400">🏆 {t("wins", { count: wins[entry.id] })}</span>}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </main>
    );
}
