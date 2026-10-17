"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getLevelTest, submitLevelTest } from "@/app/actions/levels";
import { TEST_PASS, TEST_PUZZLES } from "@/lib/curriculum";
import type { LevelExercise } from "@/lib/levelExercises";
import LevelExerciseBoard from "@/components/LevelExerciseBoard";

export default function LevelTest({ levelId, onDone }: { levelId: string; onDone: (passed: boolean) => void }) {
    const [round, setRound] = useState(0);
    return <LevelTestRound key={`${levelId}-${round}`} levelId={levelId} onDone={onDone} onRetry={() => setRound(previous => previous + 1)} />;
}

function LevelTestRound({ levelId, onDone, onRetry }: { levelId: string; onDone: (passed: boolean) => void; onRetry: () => void }) {
    const t = useTranslations("Levels");
    const [exercises, setExercises] = useState<LevelExercise[] | null>(null);
    const [results, setResults] = useState<boolean[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [outcome, setOutcome] = useState<{ passed: boolean; correct: number } | null>(null);
    const submitted = useRef(false);

    useEffect(() => {
        let cancelled = false;
        getLevelTest(levelId)
            .then(list => { if (!cancelled) setExercises(list); })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
        return () => { cancelled = true; };
    }, [levelId]);

    async function finish(next: boolean[]) {
        if (submitted.current) return;
        submitted.current = true;
        setSubmitting(true);
        setError(null);
        const correct = next.filter(Boolean).length;
        try {
            const { passed } = await submitLevelTest(levelId, correct);
            setOutcome({ passed, correct });
            onDone(passed);
        } catch {
            submitted.current = false;
            setError(t("saveFailed"));
        } finally {
            setSubmitting(false);
        }
    }

    function onContinue(unassisted: boolean) {
        const next = [...results, unassisted];
        setResults(next);
        if (next.length === TEST_PUZZLES) void finish(next);
    }

    if (!exercises) return error ? <p role="alert">{error}</p> : <div className="w-full max-w-[560px] aspect-square rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" />;
    if (exercises.length !== TEST_PUZZLES) return <p>{t("noPuzzles")}</p>;

    if (outcome) return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center space-y-3">
            <p className="text-5xl">{outcome.passed ? "🎉" : "💪"}</p>
            <p className="text-2xl font-bold">{outcome.passed ? t("passed", { correct: outcome.correct, count: exercises.length }) : t("notYet", { correct: outcome.correct, need: TEST_PASS })}</p>
            {outcome.correct < TEST_PUZZLES && <p>{t("learnedCount", { count: TEST_PUZZLES - outcome.correct })}</p>}
            <button type="button" onClick={onRetry} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold">{t("retryTest")}</button>
        </div>
    );

    if (results.length === TEST_PUZZLES) return <div className="space-y-3" role="status">
        <p>{submitting ? t("saving") : error}</p>
        {!submitting && error && <button type="button" onClick={() => void finish(results)} className="px-4 py-2 rounded-lg bg-blue-600 text-white">{t("retrySave")}</button>}
    </div>;

    const exercise = exercises[results.length];
    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("testHelp", { pass: TEST_PASS, count: TEST_PUZZLES })}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{t("testProgress", { done: results.length + 1, count: exercises.length })}</h2>
                <div className="flex gap-1" aria-label={t("scoreSoFar", { count: results.filter(Boolean).length })}>
                    {exercises.map((item, index) => <span key={item.id} title={index < results.length ? t(results[index] ? "unassisted" : "withHelp") : undefined} className={`h-3 w-3 rounded-full ${index < results.length ? (results[index] ? "bg-green-500" : "bg-amber-500") : "bg-gray-300 dark:bg-gray-600"}`} />)}
                </div>
            </div>
            <LevelExerciseBoard key={exercise.id} exercise={exercise} onContinue={onContinue} last={results.length === TEST_PUZZLES - 1} />
        </div>
    );
}
