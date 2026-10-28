"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getMyCards, type CardCollection } from "@/app/actions/cards";
import { earnedKeys } from "@/lib/masteryCards";
import { markCardsSeen } from "@/lib/seenCards";
import MasteryCardView from "@/components/MasteryCardView";

// Sections in display order; a section only shows when the collection has it.
const SECTIONS: { key: keyof CardCollection; icon: string; empty?: { href: string } }[] = [
    { key: "practices", icon: "♞", empty: { href: "/practices" } },
    { key: "themes", icon: "🧩", empty: { href: "/puzzles" } },
    { key: "activities", icon: "✨" },
    { key: "bots", icon: "🐾" },
    { key: "worlds", icon: "🌍" },
    { key: "tournaments", icon: "🏆" },
];

export default function CardsPage() {
    const t = useTranslations("Cards");
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const [cards, setCards] = useState<CardCollection | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        getMyCards().then(setCards).catch(error => {
            console.error("Failed to load cards:", error);
            setFailed(true);
        });
    }, []);

    useEffect(() => {
        if (userId && cards) markCardsSeen(userId, earnedKeys(Object.values(cards).flat()));
    }, [userId, cards]);

    const earned = cards ? Object.values(cards).flat().filter(card => card.tier).length : 0;

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300">{t("intro")}</p>
            </div>

            {failed && <p className="text-red-600 dark:text-red-400">{t("loadError")}</p>}
            {!cards && !failed && <div className="h-52 rounded-2xl bg-white dark:bg-gray-800 shadow animate-pulse" />}

            {cards && (
                <>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">{t("earnedCount", { count: earned })}</p>
                    {SECTIONS.filter(section => cards[section.key]).map(section => (
                        <section key={section.key} className="space-y-3">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{section.icon} {t(`${section.key}Title`)}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t(`${section.key}Rule`)}</p>
                            {cards[section.key]!.length ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {cards[section.key]!.map(card => <MasteryCardView key={card.id} card={card} />)}
                                </div>
                            ) : section.empty ? (
                                <p className="text-gray-600 dark:text-gray-300">
                                    {t(`${section.key}Empty`)}{" "}
                                    <Link href={section.empty.href} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">{t(`${section.key}Start`)} →</Link>
                                </p>
                            ) : null}
                        </section>
                    ))}
                </>
            )}
        </main>
    );
}
