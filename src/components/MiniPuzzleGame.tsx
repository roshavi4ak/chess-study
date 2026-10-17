"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getPuzzleLadder } from "@/app/actions/play";
import { puzzleStars, type PuzzleLevel } from "@/lib/miniGames";
import type { LadderPuzzle } from "@/lib/puzzleLadder";
import QuickPuzzleBoard from "@/components/QuickPuzzleBoard";

// A short set of easy puzzles (e.g. checkmate in one). Unrated; stars for how many were right.
export default function MiniPuzzleGame({ level, onComplete }: { level: PuzzleLevel; onComplete: (stars: number, moves: number) => void }) {
    const t = useTranslations("MiniGames");
    const [puzzles, setPuzzles] = useState<LadderPuzzle[] | null>(null);
    const [index, setIndex] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [results, setResults] = useState<boolean[]>([]);
    const [failed, setFailed] = useState(false);
    const [round, setRound] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getPuzzleLadder({ start: level.startRating, step: 20, count: level.count, tags: level.tags })
            .then(list => { if (!cancelled) setPuzzles(list); })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [level, round]);

    function onResult(solved: boolean) {
        const nextCorrect = correct + (solved ? 1 : 0);
        setResults([...results, solved]);
        setCorrect(nextCorrect);
        if (puzzles && index + 1 >= puzzles.length) onComplete(puzzleStars(nextCorrect, puzzles.length), puzzles.length);
        setIndex(index + 1);
    }

    function restart() {
        setPuzzles(null);
        setIndex(0);
        setCorrect(0);
        setResults([]);
        setRound(round + 1);
    }

    if (failed) return <p className="text-red-600 dark:text-red-400">{t("loadError")}</p>;
    if (!puzzles) return <div className="w-full max-w-[560px] aspect-square rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" />;
    if (!puzzles.length) return <p>{t("noPuzzles")}</p>;

    const done = index >= puzzles.length;
    const puzzle = puzzles[index];
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{done ? t("puzzlesDone", { correct, count: puzzles.length }) : t("findMate")}</p>
                <div className="flex gap-1" aria-label={t("puzzleProgress", { done: index, count: puzzles.length })}>
                    {puzzles.map((item, position) => (
                        <span key={item.id} className={`h-3 w-3 rounded-full ${position < results.length ? (results[position] ? "bg-green-500" : "bg-red-400") : "bg-gray-300 dark:bg-gray-600"}`} />
                    ))}
                </div>
            </div>
            {done ? (
                puzzleStars(correct, puzzles.length) === 0 && (
                    <button type="button" onClick={restart} className="px-5 py-2 rounded-lg bg-green-600 text-white font-bold">{t("tryAgain")}</button>
                )
            ) : (
                <div className="max-w-[560px]">
                    <QuickPuzzleBoard key={`${puzzle.id}-${index}`} fen={puzzle.fen} solution={puzzle.solution} onResult={onResult} />
                </div>
            )}
        </div>
    );
}
