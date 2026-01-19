"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface LeaderboardEntry {
    userId: string;
    name: string | null;
    email: string | null;
    solvedCount?: number;
    points?: number;
    completedCount?: number;
}

interface LeaderboardSectionProps {
    title: string;
    apiEndpoint: string;
}

export function LeaderboardSection({ title, apiEndpoint }: LeaderboardSectionProps) {
    const t = useTranslations("Leaderboard");
    const [activeTab, setActiveTab] = useState<"weekly" | "allTime">("weekly");
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${apiEndpoint}?period=${activeTab}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch leaderboard data");
                }
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [apiEndpoint, activeTab]);

    const tabs = [
        { key: "weekly", label: t("weekly") },
        { key: "allTime", label: t("allTime") },
    ];

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                    {title}
                </h3>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                    <nav className="-mb-px flex space-x-8">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as "weekly" | "allTime")}
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === tab.key
                                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-gray-500 dark:text-gray-400">{t("loading")}</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-8">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400">{t("noData")}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t("rank")}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t("student")}
                                    </th>
                                    {apiEndpoint.includes("puzzles") ? (
                                        <>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                {t("puzzlesSolved")}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                {t("points")}
                                            </th>
                                        </>
                                    ) : (
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            {t("openingsCompleted")}
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {data.map((entry, index) => (
                                    <tr key={entry.userId}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {entry.name || entry.email || "Anonymous"}
                                        </td>
                                        {apiEndpoint.includes("puzzles") ? (
                                            <>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {entry.solvedCount || 0}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {entry.points || 0}
                                                </td>
                                            </>
                                        ) : (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {entry.completedCount || 0}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}