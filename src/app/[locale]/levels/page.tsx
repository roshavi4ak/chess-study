"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getMyLevel, type MyLevel } from "@/app/actions/levels";
import { CURRICULUM, KING_LEVEL, TEST_PASS, TEST_PUZZLES, type CurriculumLevel } from "@/lib/curriculum";
import LevelTest from "@/components/LevelTest";
import LevelPractice from "@/components/LevelPractice";

const GROUP_ICON: Record<CurriculumLevel["group"], string> = { pawn: "♙", knight: "♘", bishop: "♗", rook: "♖", queen: "♕", king: "♔" };

export default function LevelsPage() {
    const t = useTranslations("Levels");
    const [mine, setMine] = useState<MyLevel | null>(null);
    const [selected, setSelected] = useState<CurriculumLevel | null>(null);
    const [mode, setMode] = useState<"lesson" | "practice" | "test">("lesson");
    const [round, setRound] = useState(0);

    const load = () => getMyLevel().then(setMine).catch(() => undefined);
    useEffect(() => {
        void load();
    }, []);

    if (!mine) return <main className="max-w-5xl mx-auto p-6"><div className="h-64 rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" /></main>;

    const all = [...CURRICULUM, KING_LEVEL];
    const kingOpen = mine.currentIndex >= CURRICULUM.length;
    const name = (level: CurriculumLevel) => level.id === KING_LEVEL.id ? t("kingName", { passes: mine.kingPasses }) : t("levelName", { group: t(`group_${level.group}`), number: level.number });
    const state = (level: CurriculumLevel) => level.id === KING_LEVEL.id
        ? (kingOpen ? "current" : "locked")
        : mine.passed.includes(level.id) ? "passed" : mine.currentId === level.id ? "current" : "locked";
    const active = selected ?? all.find(level => state(level) === "current") ?? KING_LEVEL;
    const startTest = () => { setSelected(active); setMode("test"); setRound(round + 1); };

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🎓 {t("title")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("intro", { count: TEST_PUZZLES, pass: TEST_PASS })}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {all.map(level => {
                    const status = state(level);
                    return (
                        <button key={level.id} type="button" disabled={status === "locked"} onClick={() => { setSelected(level); setMode("lesson"); }}
                            className={`text-left px-3 py-2 rounded-xl border-2 ${active.id === level.id ? "ring-2 ring-blue-400" : ""} ${status === "passed" ? "bg-green-50 border-green-300 text-green-800 dark:bg-green-900/30 dark:text-green-200" : status === "current" ? "bg-yellow-50 border-yellow-400 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100" : "bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700"}`}>
                            <span className="flex items-center gap-1.5 text-sm font-bold">
                                <span className="text-lg" aria-hidden>{GROUP_ICON[level.group]}</span>
                                {name(level)}
                                {status === "passed" && <Check className="h-4 w-4" />}
                                {status === "locked" && <Lock className="h-3 w-3" />}
                            </span>
                            <span className={`block text-xs leading-snug ${status === "locked" ? "text-gray-400 dark:text-gray-500" : "opacity-80"}`}>{t(`topic_${level.id}`)}</span>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    {mode === "test" ? (
                        <LevelTest key={`${active.id}-${round}`} levelId={active.id} onDone={() => void load()} />
                    ) : mode === "practice" ? (
                        <LevelPractice key={`${active.id}-${round}`} levelId={active.id} canTest={state(active) !== "locked"} onTakeTest={startTest} />
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-4">
                            <h2 className="text-2xl font-bold"><span aria-hidden>{GROUP_ICON[active.group]}</span> {name(active)}</h2>
                            <p className="font-semibold text-blue-700 dark:text-blue-300">{t("youWillLearn", { topic: t(`topic_${active.id}`) })}</p>
                            <p className="text-lg text-gray-700 dark:text-gray-200">{t(`lesson_${active.id}`)}</p>
                            {mine.best[active.id] !== undefined && <p className="text-sm text-gray-500">{t("bestScore", { score: mine.best[active.id], count: TEST_PUZZLES })}</p>}
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => { setSelected(active); setMode("practice"); setRound(round + 1); }} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium hover:bg-gray-200 dark:hover:bg-gray-600">{t("practiseFirst")}</button>
                                {state(active) !== "locked" && (
                                    <button type="button" onClick={startTest} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">
                                        {t("takeTest")}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 h-fit space-y-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("yourLevel")}</p>
                    <p className="text-2xl font-black">{GROUP_ICON[(all.find(level => state(level) === "current") ?? KING_LEVEL).group]} {name(all.find(level => state(level) === "current") ?? KING_LEVEL)}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t("passedCount", { count: mine.passed.length, total: CURRICULUM.length })}</p>
                    {mode !== "lesson" && <button type="button" onClick={() => setMode("lesson")} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">← {t("backToLesson")}</button>}
                </div>
            </div>
        </main>
    );
}
