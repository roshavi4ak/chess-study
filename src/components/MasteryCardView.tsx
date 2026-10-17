"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Lock, Puzzle } from "lucide-react";
import { BOTS } from "@/lib/bots";
import { getAvatarPath } from "@/lib/avatars";
import type { CardTier, MasteryCard } from "@/lib/masteryCards";

const TIER_STYLES: Record<CardTier, string> = {
    bronze: "bg-gradient-to-br from-orange-200 to-amber-600 text-amber-950 border-amber-700",
    silver: "bg-gradient-to-br from-gray-100 to-gray-400 text-gray-900 border-gray-500",
    gold: "bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-950 border-yellow-500 shadow-yellow-300/50",
};

export function useCardName() {
    const tCategories = useTranslations("PuzzleCategories");
    const tBots = useTranslations("Bots");
    const tWorlds = useTranslations("MiniGames");
    const tCards = useTranslations("Cards");
    return (card: MasteryCard) => {
        if (card.kind === "bot" && card.tag) return tBots(`${card.tag}Name`);
        if (card.kind === "world" && card.tag) return tWorlds(`${card.tag}Name`);
        if (card.kind === "theme" && card.tag && tCategories.has(card.tag)) return tCategories(card.tag);
        if (card.kind === "tournament") return tCards("tournamentCardName");
        return card.name;
    };
}

function CardIcon({ card }: { card: MasteryCard }) {
    const bot = card.kind === "bot" ? BOTS.find(entry => entry.id === card.tag) : undefined;
    if (bot) return <Image src={getAvatarPath(bot.avatar)} alt="" width={48} height={48} className={`h-12 w-12 object-contain ${card.tier ? "" : "grayscale"}`} />;
    if (card.kind === "theme") return <Puzzle className="h-8 w-8" />;
    return <>{{ practice: "♞", world: "🌍", tournament: "🏆" }[card.kind as "practice" | "world" | "tournament"] ?? "★"}</>;
}

export default function MasteryCardView({ card }: { card: MasteryCard }) {
    const t = useTranslations("Cards");
    const cardName = useCardName();
    const locked = !card.tier;

    return (
        <div className={`relative flex flex-col items-center text-center rounded-2xl border-2 p-4 gap-2 shadow-md min-h-52 ${locked ? "border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400" : TIER_STYLES[card.tier!]}`}>
            <div className={`flex items-center justify-center h-14 w-14 rounded-full text-4xl leading-none ${locked ? "bg-gray-200 dark:bg-gray-700" : "bg-white/60"}`} aria-hidden>
                <CardIcon card={card} />
            </div>
            <h3 className="font-bold text-base leading-tight break-words">{cardName(card)}</h3>
            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${locked ? "bg-gray-200 dark:bg-gray-700" : "bg-white/60"}`}>
                {locked ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />{t("locked")}</span> : t(card.tier!)}
            </span>
            <div className="mt-auto w-full space-y-1">
                {card.nextTarget ? (
                    <>
                        <div className={`h-2 rounded-full overflow-hidden ${locked ? "bg-gray-200 dark:bg-gray-700" : "bg-white/50"}`}>
                            <div className="h-full bg-green-600" style={{ width: `${Math.min(100, (card.current / card.nextTarget) * 100)}%` }} />
                        </div>
                        <p className="text-xs">
                            {t(`${card.kind}Progress`, { current: card.current, target: card.nextTarget })}
                        </p>
                    </>
                ) : (
                    <p className="text-xs font-bold">⭐ {t("maxed")}</p>
                )}
            </div>
        </div>
    );
}
