"use client";

import { useTranslations } from "next-intl";
import { Star, TrendingUp } from "lucide-react";
import type { EffortBoardData, EffortRow } from "@/app/actions/effort";
import { EFFORT_POINTS, MAX_PUZZLE_POINTS } from "@/lib/effortBoard";
import { MASTERY_CHECK_AFTER_RUNS, MASTERY_PERFECT_SHARE, MASTERY_RECENT_RUNS, MASTERY_STEPS } from "@/lib/reviewSchedule";
import Image from "next/image";
import ProfileLink from "@/components/ProfileLink";

const MOST_IMPROVED = 3;

function Avatar({ row }: { row: EffortRow }) {
    return row.image ? (
        <div className="w-10 h-10 shrink-0 rounded-full ring-2 ring-gray-100 dark:ring-gray-700 overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center">
            <Image src={row.image} className="w-full h-full object-contain p-0.5" alt="" loading="lazy" width={64} height={64} />
        </div>
    ) : (
        <div className="w-10 h-10 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center ring-2 ring-gray-100 dark:ring-gray-700 font-bold text-blue-600 dark:text-blue-400">
            {row.name?.[0] ?? "?"}
        </div>
    );
}

export default function EffortBoard({ data, currentUserId }: { data: EffortBoardData; currentUserId?: string }) {
    const t = useTranslations("Effort");
    const tBoard = useTranslations("Leaderboard");
    const goalClub = data.rows.filter(row => row.reachedGoal);
    const improved = [...data.rows].filter(row => row.ratingChange > 0).sort((a, b) => b.ratingChange - a.ratingChange).slice(0, MOST_IMPROVED);
    const name = (row: EffortRow) => row.name || tBoard("anonymous");

    return (
        <div className="space-y-6">
            <div className="text-center space-y-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{tBoard("weekDateRange", data.dateRange)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("howPoints", { day: EFFORT_POINTS.activeDay, line: EFFORT_POINTS.masteredLine, puzzle: EFFORT_POINTS.puzzle, max: MAX_PUZZLE_POINTS })}
                </p>
                <p className="max-w-2xl mx-auto mt-2 px-4 py-2 rounded-xl text-sm text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    {t("howMaster", { steps: MASTERY_STEPS, after: MASTERY_CHECK_AFTER_RUNS, share: Math.round(MASTERY_PERFECT_SHARE * 100), recent: MASTERY_RECENT_RUNS })}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl p-5 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-200 dark:border-yellow-800">
                    <h3 className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-500" /> {t("goalClub", { goal: data.goal })}
                    </h3>
                    {goalClub.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {goalClub.map(row => (
                                <span key={row.id} className={`px-3 py-1 rounded-full text-sm font-medium ${row.id === currentUserId ? "bg-amber-500 text-white" : "bg-white/70 dark:bg-black/20 text-amber-900 dark:text-amber-100"}`}>
                                    ⭐ <ProfileLink id={row.id}>{name(row)}</ProfileLink>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-100/80">{t("goalClubEmpty", { goal: data.goal })}</p>
                    )}
                </div>

                <div className="rounded-2xl p-5 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-800">
                    <h3 className="font-bold text-green-900 dark:text-green-100 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" /> {t("mostImproved")}
                    </h3>
                    {improved.length ? (
                        <ol className="mt-3 space-y-1">
                            {improved.map(row => (
                                <li key={row.id} className="flex justify-between text-sm">
                                    <span className="font-medium text-green-900 dark:text-green-100"><ProfileLink id={row.id}>{name(row)}</ProfileLink></span>
                                    <span className="font-bold text-green-700 dark:text-green-300">+{row.ratingChange}</span>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="mt-2 text-sm text-green-900/80 dark:text-green-100/80">{t("mostImprovedEmpty")}</p>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-4 py-4">#</th>
                                <th className="px-4 py-4">{tBoard("student")}</th>
                                <th className="px-4 py-4 text-center">{t("points")}</th>
                                <th className="px-4 py-4 text-center">{t("activeDays")}</th>
                                <th className="px-4 py-4 text-center">{t("mastered")}</th>
                                <th className="px-4 py-4 text-center">{t("puzzlesTried")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {data.rows.map((row, index) => {
                                const me = row.id === currentUserId;
                                return (
                                    <tr key={row.id} className={me ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-blue-50/30 dark:hover:bg-blue-900/10"}>
                                        <td className="px-4 py-4 text-sm font-black text-gray-400">{index + 1}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <ProfileLink id={row.id}><Avatar row={row} /></ProfileLink>
                                                <span className="font-bold text-gray-900 dark:text-white"><ProfileLink id={row.id}>{name(row)}</ProfileLink></span>
                                                {me && <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold">{t("you")}</span>}
                                                {row.reachedGoal && <Star className="w-4 h-4 fill-yellow-400 text-yellow-500" aria-label={t("goalReached")} />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center text-lg font-black text-blue-600 dark:text-blue-400">{row.effortPoints}</td>
                                        <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300">{row.activeDays} / 7</td>
                                        <td className="px-4 py-4 text-center font-bold text-green-600 dark:text-green-400">{row.masteredThisWeek}</td>
                                        <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300">{row.puzzlesTried}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {data.rows.length === 0 && (
                        <div className="py-12 text-center text-gray-500 dark:text-gray-400 font-medium">{t("empty")}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
