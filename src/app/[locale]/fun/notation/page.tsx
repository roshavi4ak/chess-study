"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getPersonalBests, recordPlaySession } from "@/app/actions/play";
import { NOTATION_DIRECTIONS, NOTATION_LEVELS, NOTATION_ROUND, notationKey, notationStars, type NotationDirection, type NotationLevel } from "@/lib/notationTrainer";
import NotationRound from "@/components/NotationRound";

const starRow = (count: number) => "★".repeat(count) + "☆".repeat(3 - count);

export default function NotationPage() {
    const t = useTranslations("Notation");
    const tFun = useTranslations("Fun");
    const [bests, setBests] = useState<Record<string, number>>({});
    const [playing, setPlaying] = useState<{ direction: NotationDirection; level: NotationLevel } | null>(null);
    const [round, setRound] = useState(0);
    const [result, setResult] = useState<number | null>(null);

    useEffect(() => {
        getPersonalBests().then(data => setBests(data.byKey)).catch(() => undefined);
    }, []);

    function start(direction: NotationDirection, level: NotationLevel) {
        setPlaying({ direction, level });
        setResult(null);
        setRound(round + 1);
    }

    function onFinish(correct: number) {
        if (!playing) return;
        setResult(correct);
        const key = notationKey(playing.direction, playing.level);
        setBests(previous => ({ ...previous, [key]: Math.max(previous[key] ?? 0, correct) }));
        recordPlaySession({ kind: "NOTATION", key, score: correct })
            .catch(error => console.error("Failed to save notation round:", error));
    }

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">✍️ {t("title")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {tFun("backToFun")}</Link>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {NOTATION_DIRECTIONS.map(direction => (
                    <section key={direction} className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t(`${direction}Title`)}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{t(`${direction}Text`)}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {NOTATION_LEVELS.map(level => {
                                const active = playing?.direction === direction && playing.level === level;
                                return (
                                    <button key={level} type="button" onClick={() => start(direction, level)}
                                        className={`rounded-xl p-2 text-center border-2 ${active ? "border-green-600 bg-green-50 dark:bg-green-900/40" : "border-gray-200 dark:border-gray-700"}`}>
                                        <span className="block font-bold">{t("level", { level })}</span>
                                        <span className="block text-xs text-gray-600 dark:text-gray-300">{t(`level${level}`)}</span>
                                        <span className="block text-sm text-amber-500">{starRow(notationStars(bests[notationKey(direction, level)] ?? 0))}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>

            {playing && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        {result === null ? (
                            <NotationRound key={round} direction={playing.direction} level={playing.level} onFinish={onFinish} />
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center space-y-3" role="status">
                                <p className="text-5xl text-amber-500 tracking-widest">{starRow(notationStars(result))}</p>
                                <p className="text-xl font-bold">{t("roundDone", { correct: result, count: NOTATION_ROUND })}</p>
                                {notationStars(result) === 0 && <p className="text-gray-600 dark:text-gray-300">{t("needSix")}</p>}
                                <div className="flex flex-wrap justify-center gap-2">
                                    <button type="button" onClick={() => start(playing.direction, playing.level)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium">{t("playAgain")}</button>
                                    {playing.level < 4 && (
                                        <button type="button" onClick={() => start(playing.direction, (playing.level + 1) as NotationLevel)} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold">{t("nextLevel")} →</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/30 rounded-2xl p-4 space-y-2 text-sm text-amber-950 dark:text-amber-50 h-fit">
                        <p className="font-bold">{t("cheatTitle")}</p>
                        <p>{t("cheatLetters")}</p>
                        <p>{t("cheatCapture")}</p>
                        <p>{t("cheatCheck")}</p>
                        <p>{t("cheatCastle")}</p>
                        <p>{t("cheatPromotion")}</p>
                        <p>{t("cheatTwo")}</p>
                    </div>
                </div>
            )}
        </main>
    );
}
