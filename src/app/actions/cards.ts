"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { loadProgressHistory } from "@/lib/progressHistory";
import { botCards, practiceCards, sortCards, themeCards, tournamentCards, worldCards, type MasteryCard } from "@/lib/masteryCards";
import { getBotWins, getPersonalBests } from "@/app/actions/play";
import { countMyTournaments } from "@/app/actions/tournaments";

export interface CardCollection {
    practices: MasteryCard[];
    themes: MasteryCard[];
    bots: MasteryCard[];
    worlds?: MasteryCard[];
    tournaments?: MasteryCard[];
}

export async function getMyCards(): Promise<CardCollection | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    const userId = session.user.id;

    const [history, solved, wins, bests, tournaments] = await Promise.all([
        // Puzzle history comes from the query below, so the loader can skip it.
        loadProgressHistory([userId], new Date()),
        prisma.puzzleAttempt.findMany({
            where: { userId, success: true },
            select: { createdAt: true, puzzle: { select: { tags: true } } },
        }),
        getBotWins(),
        getPersonalBests(),
        countMyTournaments(),
    ]);

    return {
        practices: sortCards(practiceCards(history.practiceAttempts.get(userId)!, history.practices)),
        themes: sortCards(themeCards(solved.map(attempt => ({ createdAt: attempt.createdAt, tags: attempt.puzzle.tags })))),
        // Kept in ladder order, so the next animal to beat is easy to find.
        bots: botCards(wins),
        worlds: worldCards(bests.byKey),
        tournaments: tournamentCards(tournaments),
    };
}
