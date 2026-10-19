"use client";

import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import type { ClubRecord } from "@/app/actions/play";

// Personal best plus weekly and all-time club records beside the streak and coordinates games.
export default function PersonalBestPanel({ best, club, allTime }: { best: number; club: ClubRecord[]; allTime: ClubRecord[] }) {
    const t = useTranslations("Fun");
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
            <p className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" /> {t("yourBest", { score: best })}
            </p>
            {([
                { title: "clubThisWeek", empty: "clubEmpty", entries: club },
                { title: "clubAllTime", empty: "clubAllTimeEmpty", entries: allTime },
            ] as const).map(({ title, empty, entries }) => (
                <div key={title}>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t(title)}</h3>
                    {entries.length ? (
                        <ol className="mt-1 space-y-1 text-sm">
                            {entries.map((entry, index) => (
                                <li key={`${entry.name}-${index}`} className="flex justify-between">
                                    <span>{index + 1}. {entry.name ?? "?"}</span>
                                    <span className="font-bold">{entry.score}</span>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t(empty)}</p>
                    )}
                </div>
            ))}
        </div>
    );
}
