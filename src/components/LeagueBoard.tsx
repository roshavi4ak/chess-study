"use client";

import { useTranslations } from "next-intl";
import type { LeagueView } from "@/app/actions/leagues";
import type { LeagueGroup } from "@/lib/leagueService";
import { GROUP_SIZE, PROMOTE, type LeagueTierName } from "@/lib/leagues";
import ProfileLink from "@/components/ProfileLink";

export const TIER_ICON: Record<LeagueTierName, string> = { WOOD: "🪵", STONE: "🪨", BRONZE: "🥉", SILVER: "🥈", GOLD: "🥇", DIAMOND: "💎" };

function GroupTable({ group, highlight }: { group: LeagueGroup; highlight?: string }) {
    const t = useTranslations("Leagues");
    const tBoard = useTranslations("Leaderboard");
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 font-bold">
                {TIER_ICON[group.tier]} {t(`tier_${group.tier}`)} · {t("groupNumber", { number: group.index + 1 })}
            </div>
            <ol className="divide-y divide-gray-100 dark:divide-gray-700">
                {group.rows.map(row => (
                    <li key={row.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${row.id === highlight ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}>
                        <span className="flex items-center gap-2 min-w-0">
                            <span className="w-6 text-right font-black text-gray-400">{row.rank}</span>
                            <span className="font-medium truncate"><ProfileLink id={row.id}>{row.name || tBoard("anonymous")}</ProfileLink></span>
                            {row.promotes && <span className="text-xs font-bold text-green-700 dark:text-green-400 shrink-0">⬆️ {t("movingUp")}</span>}
                        </span>
                        <span className="font-black tabular-nums">{row.points}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export default function LeagueBoard({ view, currentUserId }: { view: LeagueView; currentUserId?: string }) {
    const t = useTranslations("Leagues");
    const tBoard = useTranslations("Leaderboard");
    const label = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
    return (
        <div className="space-y-6">
            <div className="text-center space-y-1">
                <p className="text-3xl font-black">{TIER_ICON[view.myTier]} {t("yourLeague", { tier: t(`tier_${view.myTier}`) })}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{tBoard("weekDateRange", { start: label(view.monday), end: label(view.sunday) })}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("rules", { size: GROUP_SIZE, promote: PROMOTE })}</p>
            </div>
            {view.myGroup ? <GroupTable group={view.myGroup} highlight={currentUserId} /> : (
                <p className="text-center bg-white dark:bg-gray-800 rounded-2xl shadow p-6">{t("notPlaced")}</p>
            )}
            {view.allGroups && view.allGroups.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-bold">{t("allGroups")}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {view.allGroups.map(group => <GroupTable key={`${group.tier}-${group.index}`} group={group} highlight={currentUserId} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
