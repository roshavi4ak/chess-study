"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface PuzzleRanking {
    userId: string;
    name: string;
    solvedCount: number;
    points: number;
}

interface OpeningRanking {
    userId: string;
    name: string;
    completedCount: number;
}

export default function LeaderboardClient() {
    const t = useTranslations("Leaderboard");
    const [puzzleRankings, setPuzzleRankings] = useState<{
        all: PuzzleRanking[];
        weekly: PuzzleRanking[];
    }>({ all: [], weekly: [] });
    const [openingRankings, setOpeningRankings] = useState<{
        all: OpeningRanking[];
        weekly: OpeningRanking[];
    }>({ all: [], weekly: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRankings = async () => {
            try {
                const [puzzleAll, puzzleWeekly, openingAll, openingWeekly] = await Promise.all([
                    fetch("/api/leaderboard/puzzles?period=all").then(r => r.json()),
                    fetch("/api/leaderboard/puzzles?period=weekly").then(r => r.json()),
                    fetch("/api/leaderboard/openings?period=all").then(r => r.json()),
                    fetch("/api/leaderboard/openings?period=weekly").then(r => r.json()),
                ]);

                setPuzzleRankings({ all: puzzleAll, weekly: puzzleWeekly });
                setOpeningRankings({ all: openingAll, weekly: openingWeekly });
            } catch (error) {
                console.error("Error fetching rankings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRankings();
    }, []);

    if (loading) {
        return <div className="text-center py-8">{t("loading")}</div>;
    }

    const renderPuzzleTable = (rankings: PuzzleRanking[], title: string) => (
        <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">{title}</h2>
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("rank")}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("name")}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("puzzlesSolved")}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("points")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {rankings.map((ranking, index) => (
                            <tr key={ranking.userId}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {index + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                    {ranking.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {ranking.solvedCount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {ranking.points}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderOpeningTable = (rankings: OpeningRanking[], title: string) => (
        <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">{title}</h2>
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("rank")}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("name")}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("openingsCompleted")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {rankings.map((ranking, index) => (
                            <tr key={ranking.userId}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {index + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                    {ranking.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {ranking.completedCount}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div>
            <div className="mb-12">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t("puzzles")}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {renderPuzzleTable(puzzleRankings.weekly, t("weekly"))}
                    {renderPuzzleTable(puzzleRankings.all, t("allTime"))}
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t("openings")}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {renderOpeningTable(openingRankings.weekly, t("weekly"))}
                    {renderOpeningTable(openingRankings.all, t("allTime"))}
                </div>
            </div>
        </div>
    );
}