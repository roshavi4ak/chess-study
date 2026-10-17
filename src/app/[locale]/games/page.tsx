"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getPersonalBests } from "@/app/actions/play";
import { WORLDS, miniKey, worldTier } from "@/lib/miniGames";

const TIER_BADGE = { bronze: "🥉", silver: "🥈", gold: "🥇" } as const;

export default function GamesPage() {
    const t = useTranslations("MiniGames");
    const [stars, setStars] = useState<Record<string, number>>({});

    useEffect(() => {
        getPersonalBests().then(bests => setStars(bests.byKey)).catch(() => undefined);
    }, []);

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🌍 {t("title")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {WORLDS.map(world => {
                    const earned = world.levels.reduce((sum, level) => sum + Math.min(3, stars[miniKey(level.id)] ?? 0), 0);
                    const tier = worldTier(world, stars);
                    return (
                        <Link key={world.id} href={`/games/${world.id}`}
                            className="flex flex-col items-center text-center gap-2 rounded-2xl p-5 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-200 dark:border-green-800 hover:shadow-lg hover:-translate-y-0.5 transition">
                            <span className="text-6xl leading-none" aria-hidden>{world.icon}</span>
                            <span className="font-bold text-lg text-gray-900 dark:text-white">{t(`${world.id}Name`)}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-300">{t(`${world.id}Tagline`)}</span>
                            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">⭐ {earned} / {world.levels.length * 3} {tier ? TIER_BADGE[tier] : ""}</span>
                        </Link>
                    );
                })}
            </div>
        </main>
    );
}
