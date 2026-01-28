"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy, Puzzle, GraduationCap, BarChart3, ChevronUp, ChevronDown } from "lucide-react";
import { LeaderboardEntry } from "@/types/leaderboard";
import { WeeklyWinner, AllTimeWinner } from "@/app/actions/statistics";

interface LeaderboardProps {
    data: LeaderboardEntry[];
    weeklyStats?: {
        weekly: {
            puzzleWinners: WeeklyWinner[];
            practiceWinners: WeeklyWinner[];
        };
        allTime: AllTimeWinner[];
    };
}

type SortField = "count" | "points" | "completed" | "perfected";
type SortOrder = "asc" | "desc";

export default function Leaderboard({ data, weeklyStats }: LeaderboardProps) {
    const t = useTranslations("Leaderboard");
    const [section, setSection] = useState<"puzzles" | "openings" | "statistics">("puzzles");
    const [timeframe, setTimeframe] = useState<"weekly" | "allTime">("weekly");
    const [statisticsTimeframe, setStatisticsTimeframe] = useState<"lastWeek" | "allTime">("lastWeek");
    const [sortField, setSortField] = useState<SortField>(section === "puzzles" ? "points" : "perfected");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

    const sortData = (items: LeaderboardEntry[]) => {
        return [...items].sort((a, b) => {
            let valA: number, valB: number;
            if (section === "puzzles") {
                const field = sortField as "count" | "points";
                valA = a.puzzleStats[timeframe][field] || 0;
                valB = b.puzzleStats[timeframe][field] || 0;
            } else {
                const field = sortField as "completed" | "perfected";
                valA = a.openingStats[timeframe][field] || 0;
                valB = b.openingStats[timeframe][field] || 0;
            }

            if (sortOrder === "asc") return valA - valB;
            return valB - valA;
        });
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };

    const sortedData = sortData(data);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortOrder === "asc" ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4">
            <div className="flex flex-col items-center">
                <Trophy className="w-16 h-16 text-yellow-500 mb-2" />
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">
                    {t("title")}
                </h1>
            </div>

            {/* Section Toggles */}
            <div className="flex justify-center p-1 bg-gray-100 dark:bg-gray-800 rounded-xl max-w-2xl mx-auto shadow-inner">
                <button
                    onClick={() => { setSection("puzzles"); setSortField("points"); setSortOrder("desc"); }}
                    className={`flex-1 flex items-center justify-center py-3 px-6 rounded-lg text-sm font-bold transition-all duration-200 ${section === "puzzles"
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md transform scale-105"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                >
                    <Puzzle className="w-5 h-5 mr-2" />
                    {t("puzzles")}
                </button>
                <button
                    onClick={() => { setSection("openings"); setSortField("perfected"); setSortOrder("desc"); }}
                    className={`flex-1 flex items-center justify-center py-3 px-6 rounded-lg text-sm font-bold transition-all duration-200 ${section === "openings"
                        ? "bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-md transform scale-105"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                >
                    <GraduationCap className="w-5 h-5 mr-2" />
                    {t("openings")}
                </button>
                <button
                    onClick={() => { setSection("statistics"); }}
                    className={`flex-1 flex items-center justify-center py-3 px-6 rounded-lg text-sm font-bold transition-all duration-200 ${section === "statistics"
                        ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-md transform scale-105"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                >
                    <BarChart3 className="w-5 h-5 mr-2" />
                    {t("statistics")}
                </button>
            </div>

            {/* Timeframe Toggles - only show for puzzles and openings */}
            {section !== "statistics" && (
                <div className="flex justify-center space-x-2">
                    {["weekly", "allTime"].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => {
                                setTimeframe(tf as "weekly" | "allTime");
                                setSortField(section === "puzzles" ? "points" : "perfected");
                                setSortOrder("desc");
                            }}
                            className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${timeframe === tf
                                ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-300 dark:ring-blue-800"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                                }`}
                        >
                            {t(tf)}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            {section === "statistics" ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 p-8">
                    {/* Timeframe Toggles */}
                    <div className="flex justify-center space-x-2 mb-8">
                        {["lastWeek", "allTime"].map((tf) => (
                            <button
                                key={tf}
                                onClick={() => setStatisticsTimeframe(tf as "lastWeek" | "allTime")}
                                className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${statisticsTimeframe === tf
                                    ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-300 dark:ring-blue-800"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                                    }`}
                            >
                                {t(tf)}
                            </button>
                        ))}
                    </div>

                    {statisticsTimeframe === "lastWeek" ? (
                        <>
                            {/* Puzzle Winners */}
                    <div className="mb-12">
                        <div className="flex items-center mb-6">
                            <Trophy className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-2" />
                            <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">{t("weeklyPuzzleWinner")}</h3>
                        </div>
                        {weeklyStats?.weekly?.puzzleWinners && weeklyStats.weekly.puzzleWinners.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* 1st Place */}
                                {weeklyStats.weekly.puzzleWinners[0] && (
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700 md:col-span-2">
                                        <div className="space-y-4">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 mr-4">
                                                    <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-xl">
                                                        1
                                                    </div>
                                                </div>
                                                {weeklyStats.weekly.puzzleWinners[0].image ? (
                                                    <div className="w-14 h-14 rounded-full mr-4 ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden relative bg-white dark:bg-gray-800 flex items-center justify-center">
                                                        <img src={weeklyStats.weekly.puzzleWinners[0].image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={80} height={80} />
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center mr-4">
                                                        <span className="text-white font-bold text-xl">
                                                            {weeklyStats.weekly.puzzleWinners[0].name[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                                        {weeklyStats.weekly.puzzleWinners[0].name}
                                                    </h4>
                                                    {weeklyStats.weekly.puzzleWinners[0].lichessId && (
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                                            @{weeklyStats.weekly.puzzleWinners[0].lichessId}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-4xl font-black text-blue-600 dark:text-blue-400">
                                                    {weeklyStats.weekly.puzzleWinners[0].points}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{t("points")}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* 2nd and 3rd Place */}
                                <div className="space-y-4">
                                    {weeklyStats.weekly.puzzleWinners[1] && (
                                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 mr-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm">
                                                        2
                                                    </div>
                                                </div>
                                                {weeklyStats.weekly.puzzleWinners[1].image ? (
                                                    <div className="w-10 h-10 rounded-full mr-3 ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden relative bg-white dark:bg-gray-800 flex items-center justify-center">
                                                        <img src={weeklyStats.weekly.puzzleWinners[1].image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={64} height={64} />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center mr-3">
                                                        <span className="text-white font-bold text-sm">
                                                            {weeklyStats.weekly.puzzleWinners[1].name[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                                        {weeklyStats.weekly.puzzleWinners[1].name}
                                                    </h4>
                                                    {weeklyStats.weekly.puzzleWinners[1].lichessId && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            @{weeklyStats.weekly.puzzleWinners[1].lichessId}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-gray-600 dark:text-gray-400">
                                                    {weeklyStats.weekly.puzzleWinners[1].points}
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{t("points")}</p>
                                            </div>
                                        </div>
                                    )}
                                    {weeklyStats.weekly.puzzleWinners[2] && (
                                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 mr-3">
                                                    <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-sm">
                                                        3
                                                    </div>
                                                </div>
                                                {weeklyStats.weekly.puzzleWinners[2].image ? (
                                                    <div className="w-10 h-10 rounded-full mr-3 ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden relative bg-white dark:bg-gray-800 flex items-center justify-center">
                                                        <img src={weeklyStats.weekly.puzzleWinners[2].image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={64} height={64} />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center mr-3">
                                                        <span className="text-white font-bold text-sm">
                                                            {weeklyStats.weekly.puzzleWinners[2].name[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                                        {weeklyStats.weekly.puzzleWinners[2].name}
                                                    </h4>
                                                    {weeklyStats.weekly.puzzleWinners[2].lichessId && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            @{weeklyStats.weekly.puzzleWinners[2].lichessId}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-gray-600 dark:text-gray-400">
                                                    {weeklyStats.weekly.puzzleWinners[2].points}
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{t("points")}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                {t("noData")}
                            </div>
                        )}
                    </div>

                    {/* Practice Winners */}
                    <div>
                        <div className="flex items-center mb-6">
                            <Trophy className="w-8 h-8 text-purple-600 dark:text-purple-400 mr-2" />
                            <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">{t("weeklyPracticeWinner")}</h3>
                        </div>
                        {weeklyStats?.weekly?.practiceWinners && weeklyStats.weekly.practiceWinners.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* 1st Place */}
                                {weeklyStats.weekly.practiceWinners[0] && (
                                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700 md:col-span-2">
                                        <div className="space-y-4">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 mr-4">
                                                    <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-xl">
                                                        1
                                                    </div>
                                                </div>
                                                {weeklyStats.weekly.practiceWinners[0].image ? (
                                                    <div className="w-14 h-14 rounded-full mr-4 ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden relative bg-white dark:bg-gray-800 flex items-center justify-center">
                                                        <img src={weeklyStats.weekly.practiceWinners[0].image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={80} height={80} />
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center mr-4">
                                                        <span className="text-white font-bold text-xl">
                                                            {weeklyStats.weekly.practiceWinners[0].name[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                                        {weeklyStats.weekly.practiceWinners[0].name}
                                                    </h4>
                                                    {weeklyStats.weekly.practiceWinners[0].lichessId && (
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                                            @{weeklyStats.weekly.practiceWinners[0].lichessId}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-4xl font-black text-purple-600 dark:text-purple-400">
                                                    {weeklyStats.weekly.practiceWinners[0].points}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{t("perfectedLines")}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* 2nd and 3rd Place */}
                                <div className="space-y-4">
                                    {weeklyStats.weekly.practiceWinners[1] && (
                                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 mr-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm">
                                                        2
                                                    </div>
                                                </div>
                                                {weeklyStats.weekly.practiceWinners[1].image ? (
                                                    <div className="w-10 h-10 rounded-full mr-3 ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden relative bg-white dark:bg-gray-800 flex items-center justify-center">
                                                        <img src={weeklyStats.weekly.practiceWinners[1].image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={64} height={64} />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center mr-3">
                                                        <span className="text-white font-bold text-sm">
                                                            {weeklyStats.weekly.practiceWinners[1].name[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                                        {weeklyStats.weekly.practiceWinners[1].name}
                                                    </h4>
                                                    {weeklyStats.weekly.practiceWinners[1].lichessId && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            @{weeklyStats.weekly.practiceWinners[1].lichessId}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-gray-600 dark:text-gray-400">
                                                    {weeklyStats.weekly.practiceWinners[1].points}
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{t("perfectedLines")}</p>
                                            </div>
                                        </div>
                                    )}
                                    {weeklyStats.weekly.practiceWinners[2] && (
                                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 mr-3">
                                                    <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-sm">
                                                        3
                                                    </div>
                                                </div>
                                                {weeklyStats.weekly.practiceWinners[2].image ? (
                                                    <div className="w-10 h-10 rounded-full mr-3 ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden relative bg-white dark:bg-gray-800 flex items-center justify-center">
                                                        <img src={weeklyStats.weekly.practiceWinners[2].image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={64} height={64} />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center mr-3">
                                                        <span className="text-white font-bold text-sm">
                                                            {weeklyStats.weekly.practiceWinners[2].name[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                                        {weeklyStats.weekly.practiceWinners[2].name}
                                                    </h4>
                                                    {weeklyStats.weekly.practiceWinners[2].lichessId && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            @{weeklyStats.weekly.practiceWinners[2].lichessId}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-gray-600 dark:text-gray-400">
                                                    {weeklyStats.weekly.practiceWinners[2].points}
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{t("perfectedLines")}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                {t("noData")}
                            </div>
                        )}
                    </div>

                    <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {t("weekDateRange", {
                            start: "19.01.2026",
                            end: "25.01.2026"
                        })}
                    </div>
                        </>
                    ) : (
                        /* All Time Winners */
                        <div>
                            <div className="flex items-center mb-6">
                                <Trophy className="w-8 h-8 text-yellow-600 dark:text-yellow-400 mr-2" />
                                <h3 className="text-xl font-bold text-yellow-900 dark:text-yellow-100">{t("allTimeWinners")}</h3>
                            </div>
                            {weeklyStats?.allTime && weeklyStats.allTime.length > 0 ? (
                                <div className="space-y-4">
                                    {weeklyStats.allTime.map((winner, index) => (
                                        <div key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-center">
                                            <div className="flex-shrink-0 mr-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                                                    index === 0 ? 'bg-yellow-500' :
                                                    index === 1 ? 'bg-gray-400' :
                                                    index === 2 ? 'bg-amber-600' :
                                                    'bg-gray-500'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                            </div>
                                            {winner.image ? (
                                                <div className="w-12 h-12 rounded-full mr-4 ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden relative bg-white dark:bg-gray-800 flex items-center justify-center">
                                                    <img src={winner.image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={64} height={64} />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gray-500 flex items-center justify-center mr-4">
                                                    <span className="text-white font-bold text-lg">
                                                        {winner.name[0]}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                                    {winner.name}
                                                </h4>
                                                {winner.lichessId && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        @{winner.lichessId}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-gray-600 dark:text-gray-400">
                                                    {winner.weeklyWins}
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{t("weeklyWins")}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    {t("noData")}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                // Original table view for puzzles and openings
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">#</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t("student")}</th>
                                    {section === "puzzles" ? (
                                        <>
                                            <th
                                                className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors"
                                                onClick={() => handleSort("count")}
                                            >
                                                <div className="flex items-center">{t("number")} <SortIcon field="count" /></div>
                                            </th>
                                            <th
                                                className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors"
                                                onClick={() => handleSort("points")}
                                            >
                                                <div className="flex items-center">{t("points")} <SortIcon field="points" /></div>
                                            </th>
                                        </>
                                    ) : (
                                        <>
                                            <th
                                                className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest cursor-pointer hover:text-green-600 transition-colors"
                                                onClick={() => handleSort("completed")}
                                            >
                                                <div className="flex items-center">{t("linesCompleted")} <SortIcon field="completed" /></div>
                                            </th>
                                            <th
                                                className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest cursor-pointer hover:text-green-600 transition-colors"
                                                onClick={() => handleSort("perfected")}
                                            >
                                                <div className="flex items-center">{t("linesPerfected")} <SortIcon field="perfected" /></div>
                                            </th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {sortedData.map((student, index) => (
                                    <tr key={student.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                        <td className="px-6 py-5 whitespace-nowrap text-sm font-black text-gray-400">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {student.image ? (
                                                    <div className="w-10 h-10 rounded-full mr-3 ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden relative bg-white dark:bg-gray-800 flex items-center justify-center">
                                                        <img src={student.image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={64} height={64} />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3 ring-2 ring-gray-100 dark:ring-gray-700 font-bold text-blue-600 dark:text-blue-400">
                                                        {student.name && student.name.length > 0 ? student.name[0] : '?'}
                                                    </div>
                                                )}
                                                <span className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                                    {student.name || t("anonymous")}
                                                </span>
                                            </div>
                                        </td>
                                        {section === "puzzles" ? (
                                            <>
                                                <td className="px-6 py-5 whitespace-nowrap text-lg font-black text-gray-700 dark:text-gray-300">
                                                    {student.puzzleStats[timeframe].count}
                                                </td>
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <span className={`text-lg font-black ${student.puzzleStats[timeframe].points >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {student.puzzleStats[timeframe].points > 0 ? '+' : ''}{student.puzzleStats[timeframe].points}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-5 whitespace-nowrap text-lg font-black text-gray-700 dark:text-gray-300">
                                                    {student.openingStats[timeframe].completed}
                                                </td>
                                                <td className="px-6 py-5 whitespace-nowrap text-lg font-black text-green-600 dark:text-green-400">
                                                    {student.openingStats[timeframe].perfected}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedData.length === 0 && (
                            <div className="py-12 text-center text-gray-500 dark:text-gray-400 font-medium">
                                {t("noData")}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
