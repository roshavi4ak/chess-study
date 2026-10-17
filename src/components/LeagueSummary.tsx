"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getLeagueView, type LeagueView } from "@/app/actions/leagues";
import { LEAGUE_TIERS, PROMOTE } from "@/lib/leagues";
import { TIER_ICON } from "@/components/LeagueBoard";

const seenKey = (userId: string) => `chess-study:league-tier:${userId}`;

function readSeenTier(userId: string) {
    try {
        return window.localStorage.getItem(seenKey(userId));
    } catch {
        return null;
    }
}

function writeSeenTier(userId: string, tier: string) {
    try {
        window.localStorage.setItem(seenKey(userId), tier);
    } catch {
        // The celebration may simply show again.
    }
}

// Dashboard row: league, place in the group, and a one-time celebration after moving up.
export default function LeagueSummary({ userId }: { userId: string }) {
    const t = useTranslations("Leagues");
    const [view, setView] = useState<LeagueView | null>(null);
    const [movedUp, setMovedUp] = useState(false);

    useEffect(() => {
        getLeagueView().then(result => {
            if (!result) return;
            const seen = readSeenTier(userId);
            if (seen && LEAGUE_TIERS.indexOf(result.myTier) > LEAGUE_TIERS.indexOf(seen as (typeof LEAGUE_TIERS)[number])) setMovedUp(true);
            else writeSeenTier(userId, result.myTier);
            setView(result);
        }).catch(() => undefined);
    }, [userId]);

    if (!view) return null;
    const me = view.myGroup?.rows.find(row => row.id === userId);
    const tierName = t(`tier_${view.myTier}`);

    return (
        <div className="space-y-2">
            {movedUp && (
                <div className="rounded-lg p-4 bg-gradient-to-r from-sky-100 to-indigo-200 dark:from-sky-900/60 dark:to-indigo-800/60 shadow flex flex-wrap items-center justify-between gap-2" role="status">
                    <p className="font-bold">🎉 {t("promoted", { tier: tierName })} {TIER_ICON[view.myTier]}</p>
                    <button type="button" onClick={() => { writeSeenTier(userId, view.myTier); setMovedUp(false); }} className="px-3 py-1.5 rounded-lg bg-white/70 dark:bg-black/20 text-sm font-medium">{t("yay")}</button>
                </div>
            )}
            <Link href="/leaderboard?tab=leagues" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white dark:bg-gray-800 shadow px-4 py-3 hover:shadow-md transition">
                <span className="font-medium text-gray-900 dark:text-white">{TIER_ICON[view.myTier]} {t("yourLeague", { tier: tierName })}</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                    {me ? t("yourPlace", { rank: me.rank, promote: PROMOTE }) : t("joinByPlaying")} <span className="text-blue-600 dark:text-blue-400">→</span>
                </span>
            </Link>
        </div>
    );
}
