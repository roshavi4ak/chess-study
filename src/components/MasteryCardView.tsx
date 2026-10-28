"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { ArrowRight, Lock, Maximize2, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCardActivityHref } from "@/lib/cardActivity";
import { getCardArtwork } from "@/lib/cardArtwork";
import CardArtworkDialog from "@/components/CardArtworkDialog";
import type { CardTier, MasteryCard } from "@/lib/masteryCards";

const TIER_STYLES: Record<CardTier, string> = {
    bronze: "from-orange-200 via-amber-600 to-orange-300 shadow-amber-900/15",
    silver: "from-slate-100 via-slate-400 to-slate-200 shadow-slate-500/20",
    gold: "from-yellow-100 via-amber-400 to-yellow-200 shadow-amber-400/30",
};
const TIER_BADGES: Record<CardTier, string> = {
    bronze: "bg-orange-100 text-orange-900 dark:bg-orange-900/70 dark:text-orange-100",
    silver: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
    gold: "bg-amber-100 text-amber-900 dark:bg-amber-900/70 dark:text-amber-100",
};

export function useCardName() {
    const tCategories = useTranslations("PuzzleCategories");
    const tBots = useTranslations("Bots");
    const tWorlds = useTranslations("MiniGames");
    const tCards = useTranslations("Cards");
    return (card: MasteryCard) => {
        if (card.kind === "activity" && card.tag) return tCards(`activity_${card.tag}`);
        if (card.kind === "bot" && card.tag) return tBots(`${card.tag}Name`);
        if (card.kind === "world" && card.tag) return tWorlds(`${card.tag}Name`);
        if (card.kind === "theme" && card.tag && tCategories.has(card.tag)) return tCategories(card.tag);
        if (card.kind === "tournament") return tCards("tournamentCardName");
        return card.name;
    };
}

export default function MasteryCardView({ card }: { card: MasteryCard }) {
    const t = useTranslations("Cards");
    const cardName = useCardName();
    const [viewerOpen, setViewerOpen] = useState(false);
    const locked = !card.tier;
    const monochrome = locked;
    const stars = card.tier ? { bronze: 1, silver: 2, gold: 3 }[card.tier] : 0;
    const name = cardName(card);
    const progress = card.nextTarget ? Math.min(100, (card.current / card.nextTarget) * 100) : 100;

    return (
        <article className={`group relative flex flex-col rounded-[1.35rem] bg-gradient-to-br p-1.5 shadow-md motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1 ${locked ? "from-slate-200 via-slate-300 to-slate-200 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600" : TIER_STYLES[card.tier!]}`}>
            <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white text-center text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                <button type="button" onClick={() => setViewerOpen(true)} aria-label={t("openCard", { name })} aria-haspopup="dialog" className="relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-slate-100 focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-blue-500 dark:bg-slate-800">
                    <Image
                        src={getCardArtwork(card)}
                        alt=""
                        width={640}
                        height={640}
                        sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 220px"
                        className={`h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105 ${monochrome ? "grayscale" : ""}`}
                    />
                    <span className="absolute right-2 top-2 rounded-full bg-slate-950/60 p-2 text-white" aria-hidden="true"><Maximize2 className="h-4 w-4" /></span>
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/35 to-transparent" aria-hidden="true" />
                    <div className="absolute bottom-2 right-2 flex gap-0.5 rounded-full bg-slate-950/55 px-2 py-1 text-amber-300" aria-hidden="true">
                        {locked ? <Lock className="h-3.5 w-3.5 text-white" /> : [1, 2, 3].map(star => (
                            <Star key={star} className={`h-3.5 w-3.5 ${star <= stars ? "fill-current" : "text-white/40"}`} />
                        ))}
                    </div>
                </button>
                <div className="flex flex-1 flex-col items-center gap-2 p-3 sm:p-4">
                    <h3 className="min-h-10 w-full break-words text-sm font-extrabold leading-snug sm:text-base">{name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:text-xs ${locked ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : TIER_BADGES[card.tier!]}`}>
                        {locked ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden="true" />{t("locked")}</span> : t(card.tier!)}
                    </span>
                    <div className="mt-auto w-full space-y-1.5 pt-2">
                        {card.nextTarget ? (
                            <>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label={name} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                                </div>
                                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                    {t(card.kind === "activity" && card.tag === "teamwork" ? "teamworkProgress" : `${card.kind}Progress`, { current: card.current, target: card.nextTarget })}
                                </p>
                            </>
                        ) : (
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-300"><span aria-hidden="true">✦ </span>{t("maxed")}</p>
                        )}
                    </div>
                    <Link href={getCardActivityHref(card)} aria-label={t("startNamedActivity", { name })} className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-2 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                        {t("startActivity")}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Link>
                </div>
            </div>
            {viewerOpen && <CardArtworkDialog src={getCardArtwork(card).replace("/img/cards/", "/img/cards/full/")} name={name} tier={t(locked ? "locked" : card.tier!)} monochrome={monochrome} onClose={() => setViewerOpen(false)} />}
        </article>
    );
}
