"use client";

import { use, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { SkipForward } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { createRematch, joinRace, startRace, submitRaceEvent } from "@/app/actions/race";
import { useRace, secondsUntil } from "@/hooks/useRace";
import { applyRaceEvent, comboProgress, newRacer, type RaceEvent, type RacerState } from "@/lib/puzzleRace";
import QuickPuzzleBoard from "@/components/QuickPuzzleBoard";
import RaceStandings from "@/components/RaceStandings";

export default function RacePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const t = useTranslations("Race");
    const router = useRouter();
    const { data: session } = useSession();
    const { view, missing, refresh, now } = useRace(code);
    // The racer's own progress is kept locally so the next puzzle appears instantly; the server checks every answer.
    const [mine, setMine] = useState<RacerState | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (missing) {
        return <main className="max-w-xl mx-auto p-6 text-center space-y-4"><p>{t("notFound")}</p><Link href="/race" className="text-blue-600 hover:underline">{t("back")}</Link></main>;
    }
    if (!view) return <main className="max-w-xl mx-auto p-6"><div className="h-64 rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" /></main>;

    const me = view.racers.find(racer => racer.userId === session?.user?.id);
    const state = mine ?? (me ? { ...newRacer(), nextIndex: me.nextIndex, score: me.score, solved: me.solved, combo: me.combo, skipped: me.skipped } : newRacer());
    const puzzle = view.puzzles?.[state.nextIndex];
    const secondsLeft = secondsUntil(view.endsAt, now());

    function answer(event: RaceEvent) {
        if (!view?.puzzles) return;
        const next = applyRaceEvent(state, event, view.puzzles.length);
        if (!next) return;
        setMine(next);
        void submitRaceEvent(code, event);
    }

    async function run(action: () => Promise<unknown>) {
        setError(null);
        try {
            await action();
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    async function join(targetCode: string) {
        const result = await joinRace(targetCode);
        if (!result.ok) {
            setError(t(`join_${result.reason}`));
            return;
        }
        if (targetCode !== code) router.push(`/race/${targetCode}`);
        else await refresh();
    }

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🏁 {view.mode === "DUEL" ? t("duelTitle") : t("raceTitle")} <span className="text-gray-400">#{view.code}</span></h1>
                <Link href="/race" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("back")}</Link>
            </div>
            {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {view.phase === "waiting" && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center space-y-4">
                            {view.joined ? (
                                <>
                                    <p className="text-xl font-bold">{t("joinedWaiting")}</p>
                                    <p className="text-gray-600 dark:text-gray-300">
                                        {view.mode === "DUEL" ? t("duelShareCode", { code: view.code }) : t("waitForCoach")}
                                    </p>
                                    {view.mode === "DUEL" && view.isHost && (
                                        <button type="button" disabled={view.racers.length < 2} onClick={() => run(() => startRace(code))}
                                            className="px-6 py-3 rounded-lg bg-green-600 text-white text-lg font-bold hover:bg-green-700 disabled:opacity-50">
                                            {view.racers.length < 2 ? t("waitingForFriend") : t("startDuel")}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <button type="button" onClick={() => join(code)} className="px-6 py-3 rounded-lg bg-blue-600 text-white text-lg font-bold hover:bg-blue-700">{t("join")}</button>
                            )}
                        </div>
                    )}

                    {view.phase === "countdown" && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-10 text-center">
                            <p className="text-gray-500">{t("getReady")}</p>
                            <p className="text-8xl font-black text-orange-500">{secondsUntil(view.startsAt, now()) || "!"}</p>
                        </div>
                    )}

                    {view.phase === "running" && view.joined && (
                        puzzle ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-black tabular-nums w-16">{secondsLeft}s</span>
                                    <div className="flex-1 h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" title={t("combo")}>
                                        <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all" style={{ width: `${comboProgress(state.combo) * 100}%` }} />
                                    </div>
                                    <span className="text-sm font-bold text-orange-600">×{state.combo}</span>
                                </div>
                                <div className="max-w-[600px]">
                                    <QuickPuzzleBoard key={`${puzzle.id}-${state.nextIndex}`} fen={puzzle.fen} solution={puzzle.solution}
                                        onResult={solved => answer({ index: state.nextIndex, result: solved ? "solved" : "failed" })} />
                                </div>
                                <button type="button" disabled={state.skipped} onClick={() => answer({ index: state.nextIndex, result: "skip" })}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium disabled:opacity-40">
                                    <SkipForward className="h-4 w-4" /> {state.skipped ? t("skipUsed") : t("skip")}
                                </button>
                            </div>
                        ) : (
                            <p className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-xl font-bold">{t("allDone")}</p>
                        )
                    )}
                    {view.phase === "running" && !view.joined && (
                        <p className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">{t("alreadyStarted")}</p>
                    )}

                    {view.phase === "finished" && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center space-y-4">
                            <p className="text-5xl">🎉</p>
                            {me && <p className="text-2xl font-bold">{t("yourScore", { score: me.score, place: view.racers.findIndex(racer => racer.userId === me.userId) + 1 })}</p>}
                            <div className="flex flex-wrap justify-center gap-2">
                                {view.nextCode ? (
                                    <button type="button" onClick={() => join(view.nextCode!)} className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">{t("joinRematch")}</button>
                                ) : view.isHost && view.mode === "DUEL" ? (
                                    <button type="button" onClick={() => run(async () => { const next = await createRematch(code); router.push(`/race/${next.code}`); })}
                                        className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">{t("rematch")}</button>
                                ) : (
                                    <p className="text-gray-500">{t("waitForRematch")}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <RaceStandings view={view} highlight={session?.user?.id} />
            </div>
        </main>
    );
}
