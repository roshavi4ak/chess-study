import type { PlaySessionRecord } from "./dailyMission";
import { cardTier, THEME_TIER_DAYS, type MasteryCard } from "./masteryCards";
import { sofiaDay } from "./reviewSchedule";
import { CARD_ACTIVITIES, type CardActivityId } from "./cardActivities";

function qualifies(id: CardActivityId, session: PlaySessionRecord): boolean {
    switch (id) {
        case "endgames": return session.kind === "MINIGAME" && session.key.startsWith("endgame:") && session.won === true && session.score > 0;
        case "defense": return session.kind === "MINIGAME" && session.key.startsWith("defense:") && session.won === true && session.score > 0;
        case "freeplay": return session.kind === "MINIGAME" && session.key.startsWith("freeplay:") && session.score > 0;
        case "streak": return session.kind === "STREAK" && session.score > 0;
        case "coordinates": return session.kind === "COORDINATES" && session.score > 0;
        case "solo": return session.kind === "SOLO_CHESS" && session.won === true;
        case "notation": return session.kind === "NOTATION" && session.score > 0;
        case "race": return session.kind === "RACE";
        case "duel": return session.kind === "DUEL";
        case "levels": return (session.kind === "LEVEL_TEST" && session.won === true) || (session.kind === "LEVEL_PRACTICE" && session.score > 0);
        default: return false;
    }
}

// One successful day per activity, regardless of the number of same-day replays.
// Teamwork counts distinct goals/challenges to which the child actually contributed.
export function activityCards(sessions: PlaySessionRecord[], puzzles: { success: boolean; createdAt: Date }[], teamContributions = 0): MasteryCard[] {
    return CARD_ACTIVITIES.map(activity => {
        const dates = activity.id === "puzzles"
            ? puzzles.filter(puzzle => puzzle.success).map(puzzle => puzzle.createdAt)
            : sessions.filter(session => qualifies(activity.id, session)).map(session => session.createdAt);
        const current = activity.id === "teamwork" ? teamContributions : new Set(dates.map(sofiaDay)).size;
        return {
            id: `activity:${activity.id}`, kind: "activity", practiceId: null, tag: activity.id, name: activity.id,
            current, ...cardTier(current, activity.id === "teamwork" ? [1, 3, 5] : THEME_TIER_DAYS),
        };
    });
}
