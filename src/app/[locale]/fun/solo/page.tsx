"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getSoloChessProgress, recordPlaySession } from "@/app/actions/play";
import { SOLO_BANDS, nextSoloPuzzle, soloKey, type SoloBand, type SoloPuzzle } from "@/lib/soloChess";
import SOLO_PUZZLES from "@/lib/soloChessPuzzles.json";
import SoloChessGame from "@/components/SoloChessGame";

const PUZZLES = SOLO_PUZZLES as SoloPuzzle[];
const byBand = (band: SoloBand) => PUZZLES.filter(puzzle => puzzle.band === band);

export default function SoloChessPage() {
    const t = useTranslations("SoloChess");
    const tFun = useTranslations("Fun");
    const [solved, setSolved] = useState<Set<string> | null>(null);
    const [band, setBand] = useState<SoloBand>("easy");
    const [puzzle, setPuzzle] = useState<SoloPuzzle | null>(null);
    const [skipped, setSkipped] = useState<string[]>([]);
    const [result, setResult] = useState<"clean" | "helped" | null>(null);
    const [round, setRound] = useState(0);

    useEffect(() => {
        getSoloChessProgress()
            .then(progress => {
                const done = new Set(progress.solved);
                // Start in the first band that still has puzzles to solve.
                const first = SOLO_BANDS.find(entry => byBand(entry).some(item => !done.has(item.id))) ?? "easy";
                setSolved(done);
                setBand(first);
                setPuzzle(nextSoloPuzzle(byBand(first), done));
            })
            .catch(() => {
                setSolved(new Set());
                setPuzzle(nextSoloPuzzle(byBand("easy"), new Set()));
            });
    }, []);

    function chooseBand(next: SoloBand) {
        setBand(next);
        setResult(null);
        setPuzzle(nextSoloPuzzle(byBand(next), solved ?? new Set(), skipped));
        setRound(round + 1);
    }

    function onFinish(clean: boolean) {
        if (!puzzle) return;
        setResult(clean ? "clean" : "helped");
        if (clean) setSolved(previous => new Set([...(previous ?? []), puzzle.id]));
        recordPlaySession({ kind: "SOLO_CHESS", key: soloKey(puzzle.id), score: clean ? 1 : 0, won: true })
            .catch(error => console.error("Failed to save solo chess result:", error));
    }

    function next(skip = false) {
        if (!puzzle) return;
        // A puzzle finished with a hint goes to the back of the queue, like a skipped one.
        const later = skip || result === "helped" ? [...skipped.filter(id => id !== puzzle.id), puzzle.id] : skipped;
        setSkipped(later);
        setResult(null);
        setPuzzle(nextSoloPuzzle(byBand(band), solved ?? new Set(), later, puzzle.id));
        setRound(round + 1);
    }

    const bandPuzzles = byBand(band);
    const solvedInBand = bandPuzzles.filter(item => solved?.has(item.id)).length;
    const total = PUZZLES.filter(item => solved?.has(item.id)).length;

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">♟️ {t("title")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {tFun("backToFun")}</Link>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 text-slate-900 dark:text-slate-100 space-y-1">
                <p className="font-medium">{t("intro")}</p>
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                    <li>{t("ruleCapture")}</li>
                    <li>{t("ruleTwice")}</li>
                    <li>{t("ruleKing")}</li>
                </ul>
            </div>

            <div className="flex flex-wrap gap-2" role="tablist">
                {SOLO_BANDS.map(entry => {
                    const list = byBand(entry);
                    const done = list.filter(item => solved?.has(item.id)).length;
                    return (
                        <button key={entry} type="button" role="tab" aria-selected={band === entry} onClick={() => chooseBand(entry)}
                            className={`px-4 py-2 rounded-xl border-2 font-medium ${band === entry ? "border-slate-700 bg-slate-100 dark:bg-slate-700" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
                            {t(`band_${entry}`)} <span className="text-sm text-gray-500 dark:text-gray-300">{done}/{list.length}</span>
                        </button>
                    );
                })}
            </div>

            {solved === null ? (
                <div className="w-full max-w-[560px] aspect-square rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" />
            ) : !puzzle ? (
                <div className="rounded-2xl bg-green-50 dark:bg-green-900/30 p-6 text-center space-y-2">
                    <p className="text-2xl font-bold">🎉 {t("bandDone", { count: bandPuzzles.length })}</p>
                    <p className="text-gray-700 dark:text-gray-200">{t("bandDoneNext")}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <SoloChessGame key={`${puzzle.id}-${round}`} puzzle={puzzle} onFinish={onFinish} />
                    </div>
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 space-y-3">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t("puzzleNumber", { number: bandPuzzles.indexOf(puzzle) + 1, count: bandPuzzles.length })}</p>
                            <p className="font-medium">{t("solvedInBand", { done: solvedInBand, count: bandPuzzles.length })}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{t("solvedTotal", { done: total, count: PUZZLES.length })}</p>
                            {result === null && (
                                <button type="button" onClick={() => next(true)} className="w-full py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium">{t("skip")}</button>
                            )}
                        </div>
                        {result && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center space-y-3" role="status">
                                <p className="text-5xl">{result === "clean" ? "⭐" : "💡"}</p>
                                <p className="text-xl font-bold">{result === "clean" ? t("solvedClean") : t("solvedHelped")}</p>
                                <button type="button" onClick={() => next()} className="px-5 py-2 rounded-lg bg-green-600 text-white font-bold">{t("next")} →</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
