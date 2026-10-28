"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { loadProgressHistory } from "@/lib/progressHistory";
import { botCards, practiceCards, sortCards, themeCards, tournamentCards, worldCards, type MasteryCard } from "@/lib/masteryCards";
import { getBotWins, getPersonalBests } from "@/app/actions/play";
import { countMyTournaments } from "@/app/actions/tournaments";
import { activityCards } from "@/lib/activityCards";
import { goalValue, isGoalMetric, type GoalDefinition } from "@/lib/clubGoals";

export interface CardCollection {
    practices: MasteryCard[];
    themes: MasteryCard[];
    activities?: MasteryCard[];
    bots: MasteryCard[];
    worlds?: MasteryCard[];
    tournaments?: MasteryCard[];
}

export async function getMyCards(): Promise<CardCollection | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    const userId = session.user.id;

    const goalFields = { metric: true, tag: true, practiceId: true, startsOn: true, endsOn: true } as const;
    const [history, puzzles, wins, bests, tournaments, catalog, challenges, goals] = await Promise.all([
        // Puzzle history comes from the query below, so the loader can skip it.
        loadProgressHistory([userId], new Date()),
        prisma.puzzleAttempt.findMany({
            where: { userId },
            select: { success: true, createdAt: true, challengePoints: true, puzzle: { select: { tags: true } } },
        }),
        getBotWins(),
        getPersonalBests(),
        countMyTournaments(),
        prisma.practice.findMany({ select: { id: true, name: true, nodes: { select: { id: true, parentId: true } } } }),
        prisma.teamChallenge.findMany({ where: { members: { some: { userId } } }, select: goalFields }).catch(error => { console.error("[Cards] Could not load team challenges:", error); return []; }),
        session.user.role === "STUDENT" ? prisma.clubGoal.findMany({ select: goalFields }).catch(error => { console.error("[Cards] Could not load club goals:", error); return []; }) : [],
    ]);

    // Include every available practice, not just the ones already played by this child.
    for (const practice of catalog) {
        const parents = new Set(practice.nodes.map(node => node.parentId));
        history.practices.set(practice.id, { name: practice.name, leafIds: practice.nodes.filter(node => !parents.has(node.id)).map(node => node.id) });
    }
    const activity = {
        puzzleAttempts: puzzles.map(attempt => ({ success: attempt.success, createdAt: attempt.createdAt, challengePoints: attempt.challengePoints, tags: attempt.puzzle.tags })),
        practiceAttempts: history.practiceAttempts.get(userId) ?? [],
        playSessions: history.playSessions.get(userId) ?? [],
    };
    const teamContributions = [...challenges, ...goals].filter(goal => {
        if (!isGoalMetric(goal.metric)) return false;
        const definition: GoalDefinition = { ...goal, metric: goal.metric, startsOn: goal.startsOn.toISOString().slice(0, 10), endsOn: goal.endsOn.toISOString().slice(0, 10) };
        return goalValue(definition, activity, history.practices) > 0;
    }).length;

    return {
        practices: sortCards(practiceCards(history.practiceAttempts.get(userId)!, history.practices)),
        themes: sortCards(themeCards(activity.puzzleAttempts.filter(attempt => attempt.success))),
        activities: sortCards(activityCards(activity.playSessions, activity.puzzleAttempts, teamContributions)),
        // Kept in ladder order, so the next animal to beat is easy to find.
        bots: botCards(wins),
        worlds: worldCards(bests.byKey),
        tournaments: tournamentCards(tournaments),
    };
}
