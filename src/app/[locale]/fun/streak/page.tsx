"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SkipForward } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPersonalBests, getPuzzleLadder, recordPlaySession, type PersonalBests } from "@/app/actions/play";
import { STREAK_STEP, type LadderPuzzle } from "@/lib/puzzleLadder";
import QuickPuzzleBoard from "@/components/QuickPuzzleBoard";
import PersonalBestPanel from "@/components/PersonalBestPanel";

const BATCH = 30;

type Phase = "ready" | "loading" | "playing" | "over";

export default function StreakPage() {
    const t = useTranslations("Fun");
    const [bests, setBests] = useState<PersonalBests | null>(null);
    const [phase, setPhase] = useState<Phase>("ready");
    const [puzzles, setPuzzles] = useState<LadderPuzzle[]>([]);
    const [index, setIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [skipUsed, setSkipUsed] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        getPersonalBests().then(setBests).catch(() => undefined);
    }, []);

    async function start() {
        setPhase("loading");
        setError(false);
        try {
            const ladder = await getPuzzleLadder({ count: BATCH, step: STREAK_STEP });
            if (!ladder.length) throw new Error("No puzzles");
            setPuzzles(ladder);
            setIndex(0);
            setScore(0);
            setSkipUsed(false);
            setPhase("playing");
        } catch (err) {
            console.error("Failed to load streak puzzles:", err);
            setError(true);
            setPhase("ready");
        }
    }

    async function next(solvedScore: number) {
        const nextIndex = index + 1;
        if (nextIndex >= puzzles.length) {
            // Keep climbing from the last rating instead of ending the run.
            const last = puzzles[puzzles.length - 1];
            const more = await getPuzzleLadder({ start: last.rating + STREAK_STEP, count: BATCH, step: STREAK_STEP }).catch(() => []);
            const seen = new Set(puzzles.map(puzzle => puzzle.id));
            const fresh = more.filter(puzzle => !seen.has(puzzle.id));
            if (!fresh.length) return finish(solvedScore);
            setPuzzles([...puzzles, ...fresh]);
        }
        setIndex(nextIndex);
    }

    function finish(finalScore: number) {
        setPhase("over");
        recordPlaySession({ kind: "STREAK", score: finalScore })
            .then(() => getPersonalBests().then(setBests))
            .catch(error => console.error("Failed to save streak:", error));
    }

    function onResult(solved: boolean) {
        if (!solved) return finish(score);
        const newScore = score + 1;
        setScore(newScore);
        void next(newScore);
    }

    const puzzle = puzzles[index];

    return (
        <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🔥 {t("streakTitle")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                    {phase === "playing" && puzzle ? (
                        <>
                            <div className="flex justify-between items-center">
                                <span className="text-xl font-bold text-gray-900 dark:text-white">{t("findBestMove")}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{t("puzzleRating", { rating: puzzle.rating })}</span>
                            </div>
                            <div className="max-w-[600px]">
                                <QuickPuzzleBoard key={puzzle.id} fen={puzzle.fen} solution={puzzle.solution} onResult={onResult} />
                            </div>
                        </>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4 text-center">
                            {phase === "over" ? (
                                <>
                                    <p className="text-5xl">🎉</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{t("streakOver", { score })}</p>
                                    {bests && score > 0 && score >= bests.streak && <p className="text-green-600 dark:text-green-400 font-bold">{t("newBest")}</p>}
                                </>
                            ) : (
                                <p className="text-gray-700 dark:text-gray-300">{t("streakIntro")}</p>
                            )}
                            {error && <p className="text-red-600 dark:text-red-400">{t("loadError")}</p>}
                            <button type="button" onClick={start} disabled={phase === "loading"} className="px-6 py-3 rounded-lg bg-green-600 text-white text-lg font-bold hover:bg-green-700 disabled:opacity-50">
                                {phase === "loading" ? t("loading") : phase === "over" ? t("playAgain") : t("start")}
                            </button>
                        </div>
                    )}
                </div>
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t("streakScore")}</p>
                        <p className="text-5xl font-black text-orange-500">{score}</p>
                        {phase === "playing" && (
                            <button type="button" disabled={skipUsed} onClick={() => { setSkipUsed(true); void next(score); }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium disabled:opacity-40">
                                <SkipForward className="h-4 w-4" /> {skipUsed ? t("skipUsed") : t("skip")}
                            </button>
                        )}
                    </div>
                    {bests && <PersonalBestPanel best={bests.streak} club={bests.clubWeek.streak} allTime={bests.clubAllTime.streak} />}
                </div>
            </div>
        </main>
    );
}
