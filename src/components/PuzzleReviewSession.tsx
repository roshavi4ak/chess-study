"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PuzzleSolver from "./PuzzleSolver";
import { orderThemes, themeLabel } from "@/lib/puzzleThemes";
import { isSkillTag } from "@/lib/dailyMission";

interface ReviewPuzzle { id: string; name: string; fen: string; solution: string; hints: string[]; tags: string[]; fresh: boolean }
export default function PuzzleReviewSession({ items }: { items: ReviewPuzzle[] }) {
    const t = useTranslations("PuzzleReview");
    const tPuzzles = useTranslations("Puzzles");
    const tCategories = useTranslations("PuzzleCategories");
    const [index, setIndex] = useState(0);
    const [independent, setIndependent] = useState(0);
    const puzzle = items[index];
    if (!puzzle) return <div className="rounded-2xl bg-green-50 text-green-950 p-6 text-center space-y-4"><h2 className="text-2xl font-bold">{t("done")}</h2><p>{t("summary", { count: items.length, independent })}</p><p>{t("comeBack")}</p><Link href="/dashboard" className="inline-block rounded-lg bg-green-600 px-4 py-2 text-white">{t("back")}</Link></div>;
    return <section className="space-y-4"><div className="rounded-xl bg-blue-50 text-blue-950 p-4 text-center space-y-2"><h2 className="text-lg font-bold">{t(puzzle.fresh ? "fresh" : "retry")}</h2><p>{t("progress", { current: index + 1, total: items.length })}</p><p className="text-sm">{t("unrated")}</p></div>
        <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white break-words">{puzzle.name}</h3>
            {puzzle.tags.length > 0 && <div className="flex flex-wrap justify-center items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{tPuzzles("themes")}:</span>
                {orderThemes(puzzle.tags).map(theme => <span key={theme} title={theme} className={`px-2 py-1 rounded text-xs ${isSkillTag(theme) ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>{themeLabel(theme, tCategories)}</span>)}
            </div>}
        </div>
        <PuzzleSolver key={puzzle.id} id={puzzle.id} name={puzzle.name} fen={puzzle.fen} solution={puzzle.solution} hints={puzzle.hints} reviewMode onSolve={result => { if (result === "success") setIndependent(count => count + 1); }} onContinue={() => setIndex(value => value + 1)} />
    </section>;
}
