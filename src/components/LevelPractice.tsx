"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getLevelPractice, recordLevelPractice } from "@/app/actions/levels";
import { TEST_PUZZLES } from "@/lib/curriculum";
import type { LevelExercise } from "@/lib/levelExercises";
import LevelExerciseBoard from "@/components/LevelExerciseBoard";
import type { ExerciseReview } from "@/lib/attemptMoves";

// Fetch the next batch while this many exercises are still waiting.
const PREFETCH_AT = 3;
// Recent results shown as dots.
const RECENT_DOTS = 10;

// Practice on the Levels page: the same kind of exercises as the test, no pass mark and no end until the child stops.
// Finished blocks of TEST_PUZZLES exercises are saved as practice rounds, so the coach sees the work even if the page is just closed.
export default function LevelPractice({ levelId, canTest, onTakeTest }: { levelId: string; canTest: boolean; onTakeTest: () => void }) {
    const t = useTranslations("Levels");
    const [queue, setQueue] = useState<LevelExercise[]>([]);
    const [results, setResults] = useState<boolean[]>([]);
    const reviews = useRef<ExerciseReview[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [empty, setEmpty] = useState(false);
    const [stopped, setStopped] = useState(false);
    const seen = useRef(new Set<string>());
    const loading = useRef(false);
    const saved = useRef(0); // results already saved as practice rounds

    const loadMore = useCallback(async () => {
        if (loading.current) return;
        loading.current = true;
        try {
            const batch = await getLevelPractice(levelId);
            // Prefer positions not seen yet; repeat only once a small topic runs out.
            const fresh = batch.filter(exercise => !seen.current.has(exercise.id));
            const next = fresh.length ? fresh : batch;
            next.forEach(exercise => seen.current.add(exercise.id));
            setQueue(previous => [...previous, ...next.map((exercise, index) => ({ ...exercise, id: `${exercise.id}#${seen.current.size}-${index}` }))]);
            if (!batch.length) setEmpty(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            loading.current = false;
        }
    }, [levelId]);

    useEffect(() => {
        void loadMore();
    }, [loadMore]);

    useEffect(() => {
        if (!stopped && queue.length - results.length <= PREFETCH_AT && queue.length > 0) void loadMore();
    }, [queue.length, results.length, stopped, loadMore]);

    function save(upTo: number, list: boolean[]) {
        const block = list.slice(saved.current, upTo);
        if (!block.length) return;
        const blockReviews = reviews.current.slice(saved.current, upTo);
        saved.current = upTo;
        void recordLevelPractice(levelId, block.filter(Boolean).length, block.length, blockReviews).catch(() => undefined);
    }

    function onContinue(unassisted: boolean, review?: ExerciseReview) {
        if (review) reviews.current.push(review);
        const next = [...results, unassisted];
        setResults(next);
        if (next.length - saved.current >= TEST_PUZZLES) save(next.length, next);
    }

    function stop() {
        save(results.length, results);
        setStopped(true);
    }

    function resume() {
        setStopped(false);
    }

    const correct = results.filter(Boolean).length;

    if (error && !queue.length) return <p role="alert">{error}</p>;
    if (empty && !queue.length) return <p>{t("noPuzzles")}</p>;
    if (!queue.length) return <div className="w-full max-w-[560px] aspect-square rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" />;

    if (stopped) return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center space-y-3">
            <p className="text-5xl">{results.length && correct === results.length ? "🌟" : "👍"}</p>
            <p className="text-2xl font-bold">{t("practiceDone", { correct, count: results.length })}</p>
            <p className="text-gray-600 dark:text-gray-300">{t("practiceDoneHint")}</p>
            <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={resume} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700">{t("practiceMore")}</button>
                {canTest && <button type="button" onClick={onTakeTest} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">{t("takeTest")}</button>}
            </div>
        </div>
    );

    const exercise = queue[results.length];
    const recent = results.slice(-RECENT_DOTS);
    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("practiceHelp")}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{t("practiceProgress", { done: results.length + 1 })}</h2>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{t("practiceStats", { correct, helped: results.length - correct })}</span>
                    <div className="flex gap-1" aria-hidden>
                        {recent.map((result, index) => <span key={index} className={`h-3 w-3 rounded-full ${result ? "bg-green-500" : "bg-amber-500"}`} />)}
                    </div>
                    <button type="button" onClick={stop} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">{t("practiceStop")}</button>
                </div>
            </div>
            {exercise
                ? <LevelExerciseBoard key={exercise.id} exercise={exercise} onContinue={onContinue} last={false} />
                : error ? <p role="alert">{error}</p>
                    : empty ? <p>{t("noPuzzles")}</p>
                        : <div className="w-full max-w-[560px] aspect-square rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" />}
        </div>
    );
}
