"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getMyCards } from "@/app/actions/cards";
import { earnedKeys, type CardTier, type MasteryCard } from "@/lib/masteryCards";
import { markCardsSeen, readSeenCards } from "@/lib/seenCards";
import { useCardName } from "@/components/MasteryCardView";

const MEDALS: Record<CardTier, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
const MAX_NAMED = 3;

export default function CardsSummary({ userId }: { userId: string }) {
    const t = useTranslations("Cards");
    const cardName = useCardName();
    const [cards, setCards] = useState<MasteryCard[] | null>(null);
    const [fresh, setFresh] = useState<MasteryCard[]>([]);

    useEffect(() => {
        getMyCards().then(collection => {
            if (!collection) return;
            const all = Object.values(collection).flat();
            const seen = readSeenCards(userId) ?? new Set<string>();
            // A card is fresh when its current tier has not been celebrated in this browser yet.
            setFresh(all.filter(card => card.tier && !seen.has(`${card.id}:${card.tier}`)));
            setCards(all);
        }).catch(error => console.error("Failed to load cards:", error));
    }, [userId]);

    if (!cards) return null;

    const counts = (["gold", "silver", "bronze"] as CardTier[]).map(tier => [tier, cards.filter(card => card.tier === tier).length] as const);
    const dismiss = () => {
        markCardsSeen(userId, earnedKeys(cards));
        setFresh([]);
    };

    return (
        <div className="space-y-3">
            {fresh.length > 0 && (
                <div className="rounded-lg p-4 bg-gradient-to-r from-yellow-100 to-amber-200 dark:from-yellow-900/60 dark:to-amber-800/60 text-amber-950 dark:text-amber-50 shadow" role="status">
                    <p className="text-lg font-bold">🎉 {t("newCards", { count: fresh.length })}</p>
                    <ul className="mt-1 text-sm">
                        {fresh.slice(0, MAX_NAMED).map(card => (
                            <li key={card.id}>{MEDALS[card.tier!]} {cardName(card)} — {t(card.tier!)}</li>
                        ))}
                        {fresh.length > MAX_NAMED && <li>{t("andMore", { count: fresh.length - MAX_NAMED })}</li>}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Link href="/cards" onClick={dismiss} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700">{t("seeCollection")}</Link>
                        <button type="button" onClick={dismiss} className="px-3 py-1.5 rounded-lg bg-white/60 dark:bg-black/20 text-sm font-medium">{t("nice")}</button>
                    </div>
                </div>
            )}
            <Link href="/cards" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white dark:bg-gray-800 shadow px-4 py-3 hover:shadow-md transition">
                <span className="font-medium text-gray-900 dark:text-white">{t("myCards")}</span>
                <span className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
                    {counts.map(([tier, count]) => <span key={tier} aria-label={`${t(tier)}: ${count}`}>{MEDALS[tier]} {count}</span>)}
                    <span className="text-blue-600 dark:text-blue-400">→</span>
                </span>
            </Link>
        </div>
    );
}
