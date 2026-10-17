"use server";

import { auth } from "@/auth";
import { getMyCards } from "@/app/actions/cards";
import { getMyLevel } from "@/app/actions/levels";
import { BOTS } from "@/lib/bots";
import { TEST_PASS } from "@/lib/curriculum";

export interface Certificate {
    id: string; // used in the URL
    kind: "card" | "allBots" | "world" | "level";
    // What the certificate is for: a card (kind + name parts), a world id or a level id.
    cardKind?: string;
    subject: string;
}

// Every certificate the child has earned, worked out from their progress (nothing is stored).
export async function getMyCertificates(): Promise<{ name: string | null; list: Certificate[] } | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    const [cards, level] = await Promise.all([getMyCards(), getMyLevel().catch(() => null)]);
    const list: Certificate[] = [];
    if (cards) {
        for (const card of Object.values(cards).flat()) {
            if (card.tier === "gold" && card.kind !== "world") list.push({ id: `card-${card.id.replace(/[^\w-]/g, "_")}`, kind: "card", cardKind: card.kind, subject: card.tag ?? card.name });
        }
        if (cards.bots.filter(card => card.tier).length === BOTS.length) list.push({ id: "all-bots", kind: "allBots", subject: "" });
        for (const world of cards.worlds ?? []) if (world.tier) list.push({ id: `world-${world.tag}`, kind: "world", subject: world.tag! });
    }
    if (level) {
        for (const id of level.passed) if ((level.best[id] ?? 0) >= TEST_PASS) list.push({ id: `level-${id}`, kind: "level", subject: id });
    }
    return { name: session.user.name ?? null, list };
}
