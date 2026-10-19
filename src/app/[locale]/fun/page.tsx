"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getBotWins, getPersonalBests, type PersonalBests } from "@/app/actions/play";
import { BOTS } from "@/lib/bots";

const TILES = [
    { href: "/play/bots", icon: "🐾", key: "bots", color: "from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30" },
    { href: "/fun/endgames", icon: "♜", key: "endgames", color: "from-indigo-50 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30" },
    { href: "/fun/defense", icon: "🔎", key: "defense", color: "from-teal-50 to-emerald-100 dark:from-teal-900/30 dark:to-emerald-900/30" },
    { href: "/games", icon: "🌍", key: "games", color: "from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30" },
    { href: "/fun/streak", icon: "🔥", key: "streak", color: "from-red-50 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30" },
    { href: "/race", icon: "🏁", key: "race", color: "from-sky-50 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30" },
    { href: "/fun/coordinates", icon: "🎯", key: "coordinates", color: "from-violet-50 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30" },
    { href: "/levels", icon: "🎓", key: "levels", color: "from-yellow-50 to-lime-100 dark:from-yellow-900/30 dark:to-lime-900/30" },
    { href: "/tournaments", icon: "🏆", key: "tournaments", color: "from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30" },
    { href: "/cards", icon: "🃏", key: "cards", color: "from-pink-50 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30" },
    { href: "/certificates", icon: "📜", key: "certificates", color: "from-stone-50 to-amber-50 dark:from-stone-800/50 dark:to-amber-900/20" },
] as const;

export default function FunPage() {
    const t = useTranslations("FunHub");
    const [bests, setBests] = useState<PersonalBests | null>(null);
    const [beaten, setBeaten] = useState<number | null>(null);

    useEffect(() => {
        getPersonalBests().then(setBests).catch(() => undefined);
        getBotWins().then(wins => setBeaten(Object.values(wins).filter(count => count > 0).length)).catch(() => undefined);
    }, []);

    const extra = (key: (typeof TILES)[number]["key"]) => {
        if (key === "streak" && bests?.streak) return t("best", { score: bests.streak });
        if (key === "coordinates" && bests?.coordinates) return t("best", { score: bests.coordinates });
        if (key === "bots" && beaten !== null) return t("botsBeaten", { count: beaten, total: BOTS.length });
        return null;
    };

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">✨ {t("title")}</h1>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {TILES.map(tile => (
                    <Link key={tile.key} href={tile.href}
                        className={`flex flex-col items-center text-center gap-2 rounded-2xl p-5 bg-gradient-to-br ${tile.color} border border-black/5 dark:border-white/10 hover:shadow-lg hover:-translate-y-0.5 transition`}>
                        <span className="text-5xl leading-none" aria-hidden>{tile.icon}</span>
                        <span className="font-bold text-lg text-gray-900 dark:text-white">{t(`${tile.key}Title`)}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{t(`${tile.key}Text`)}</span>
                        {extra(tile.key) && <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{extra(tile.key)}</span>}
                    </Link>
                ))}
            </div>
        </main>
    );
}
