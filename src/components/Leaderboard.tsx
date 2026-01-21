"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy, Puzzle, GraduationCap, ChevronUp, ChevronDown } from "lucide-react";
import { LeaderboardEntry } from "@/types/leaderboard";

interface LeaderboardProps {
    data: LeaderboardEntry[];
}

type SortField = "count" | "points" | "completed" | "perfected";
type SortOrder = "asc" | "desc";

export default function Leaderboard({ data }: LeaderboardProps) {
    const t = useTranslations("Leaderboard");
    const [section, setSection] = useState<"puzzles" | "openings">("puzzles");
    const [timeframe, setTimeframe] = useState<"weekly" | "allTime">("weekly");
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
            <div className="flex justify-center p-1 bg-gray-100 dark:bg-gray-800 rounded-xl max-w-sm mx-auto shadow-inner">
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
            </div>

            {/* Timeframe Toggles */}
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

            {/* Table */}
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
        </div>
    );
}
