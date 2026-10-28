"use client";

import { ChessnutSession } from "@/components/ChessnutSession";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPersonalBests, recordPlaySession } from "@/app/actions/play";
import { WORLDS, levelOpen, miniKey } from "@/lib/miniGames";
import MiniBoardGame from "@/components/MiniBoardGame";
import PawnWarsGame from "@/components/PawnWarsGame";
import MiniPuzzleGame from "@/components/MiniPuzzleGame";

const starRow = (count: number) => "★".repeat(count) + "☆".repeat(3 - count);

export default function WorldPage({ params }: { params: Promise<{ world: string }> }) {
    return <ChessnutSession><WorldPageContent params={params} /></ChessnutSession>;
}

function WorldPageContent({ params }: { params: Promise<{ world: string }> }) {
    const { world: worldId } = use(params);
    const t = useTranslations("MiniGames");
    const world = WORLDS.find(entry => entry.id === worldId);
    const [stars, setStars] = useState<Record<string, number>>({});
    const [levelIndex, setLevelIndex] = useState<number | null>(null);
    const [round, setRound] = useState(0);
    const [result, setResult] = useState<number | null>(null);

    useEffect(() => {
        getPersonalBests().then(bests => setStars(bests.byKey)).catch(() => undefined);
    }, []);

    if (!world) return <main className="max-w-xl mx-auto p-6"><Link href="/games" className="text-blue-600 hover:underline">← {t("allWorlds")}</Link></main>;

    const level = levelIndex !== null ? world.levels[levelIndex] : null;

    function open(index: number) {
        setLevelIndex(index);
        setResult(null);
        setRound(round + 1);
    }

    function onComplete(earned: number, moves: number) {
        if (!level) return;
        setResult(earned);
        if (earned <= 0) return;
        const key = miniKey(level.id);
        setStars(previous => ({ ...previous, [key]: Math.max(previous[key] ?? 0, earned) }));
        recordPlaySession({ kind: "MINIGAME", key, score: earned, details: { moves } }).catch(error => console.error("Failed to save mini-game:", error));
    }

    const hasNext = levelIndex !== null && levelIndex + 1 < world.levels.length;

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white"><span aria-hidden>{world.icon}</span> {t(`${world.id}Name`)}</h1>
                <Link href="/games" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("allWorlds")}</Link>
            </div>
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/30 p-4 text-amber-950 dark:text-amber-50 text-lg">💬 {t(`${world.id}Story`)}</div>

            <div className="flex flex-wrap gap-2">
                {world.levels.map((entry, index) => {
                    const isOpen = levelOpen(world, index, stars);
                    const earned = Math.min(3, stars[miniKey(entry.id)] ?? 0);
                    return (
                        <button key={entry.id} type="button" disabled={!isOpen} onClick={() => open(index)}
                            className={`w-20 rounded-xl p-2 text-center border-2 ${levelIndex === index ? "border-green-600 bg-green-50 dark:bg-green-900/40" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"} disabled:opacity-50`}>
                            <span className="block text-xl font-black">{isOpen ? index + 1 : <Lock className="h-5 w-5 mx-auto" />}</span>
                            <span className="block text-sm text-amber-500">{starRow(earned)}</span>
                        </button>
                    );
                })}
            </div>

            {level ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        {level.type === "board" && <MiniBoardGame key={round} level={level} onComplete={onComplete} />}
                        {level.type === "pawnWars" && <PawnWarsGame key={round} level={level} onComplete={onComplete} />}
                        {level.type === "puzzles" && <MiniPuzzleGame key={round} level={level} onComplete={onComplete} />}
                    </div>
                    {result !== null && result > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center space-y-3 h-fit">
                            <p className="text-5xl text-amber-500 tracking-widest">{starRow(result)}</p>
                            <p className="text-xl font-bold">{result === 3 ? t("perfect") : t("wellDone")}</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                <button type="button" onClick={() => open(levelIndex!)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium">{t("playAgain")}</button>
                                {hasNext && <button type="button" onClick={() => open(levelIndex! + 1)} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold">{t("nextLevel")} →</button>}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-gray-600 dark:text-gray-300">{t("pickLevel")}</p>
            )}
        </main>
    );
}
