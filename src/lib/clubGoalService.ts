import { prisma } from "@/lib/db";
import type { PlaySessionRecord, PracticeAttemptRecord, PracticeInfo } from "@/lib/dailyMission";
import { getExcludedLichessIds } from "@/lib/leaderboardExclusions";
import { addDays } from "@/lib/reviewSchedule";
import { goalValue, type GoalActivity, type GoalDefinition, type GoalPuzzleAttempt } from "@/lib/clubGoals";

// Children who take part in teams and club goals: students not hidden from the leaderboards.
export async function loadClubStudents() {
    return prisma.user.findMany({
        where: { role: "STUDENT", lichessId: { notIn: await getExcludedLichessIds() } },
        select: { id: true, name: true, ratingPuzzle: true },
        orderBy: { name: "asc" },
    });
}

// @db.Date values arrive as UTC midnight of the stored calendar day.
export const dayOf = (date: Date) => date.toISOString().slice(0, 10);
export const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);

// Each child's contribution to a goal over its period.
export async function goalValues(goal: GoalDefinition, userIds: string[]): Promise<Map<string, number>> {
    const values = new Map<string, number>(userIds.map(id => [id, 0]));
    if (!userIds.length || goal.metric === "MANUAL") return values;

    // A day of margin on both sides; the exact Sofia days are checked in goalValue.
    const createdAt = { gte: dateOf(addDays(goal.startsOn, -1)), lt: dateOf(addDays(goal.endsOn, 2)) };
    const mastery = goal.metric === "LINES_MASTERED";
    const needsPuzzles = ["PUZZLES_SOLVED", "PUZZLES_TRIED", "PUZZLE_POINTS", "ACTIVE_DAYS"].includes(goal.metric);
    const needsLines = mastery || ["LINES_PLAYED", "PERFECT_LINES", "ACTIVE_DAYS"].includes(goal.metric);
    const needsPlays = ["ACTIVE_DAYS", "FUN_GAMES", "BOT_WINS", "SOLO_SOLVED", "NOTATION_CORRECT", "LEVELS_PASSED", "TOURNAMENTS"].includes(goal.metric);

    const [puzzleRows, practiceRows, playRows] = await Promise.all([
        needsPuzzles
            ? prisma.puzzleAttempt.findMany({
                where: { userId: { in: userIds }, createdAt },
                select: { userId: true, success: true, challengePoints: true, createdAt: true, puzzle: { select: { tags: true } } },
            })
            : [],
        needsLines
            ? prisma.practiceAttempt.findMany({
                // Mastery depends on every earlier run of a line, so it needs the whole history.
                where: { userId: { in: userIds }, ...(mastery ? { createdAt: { lt: createdAt.lt } } : { createdAt }) },
                select: { userId: true, practiceId: true, nodeId: true, status: true, createdAt: true },
            })
            : [],
        needsPlays
            ? prisma.playSession.findMany({
                where: { userId: { in: userIds }, createdAt },
                select: { userId: true, kind: true, key: true, score: true, won: true, createdAt: true },
            }).catch(error => {
                console.error("[ClubGoals] Could not load play sessions:", error);
                return [];
            })
            : [],
    ]);

    let practices = new Map<string, PracticeInfo>();
    if (mastery) {
        const trees = await prisma.practice.findMany({
            where: { id: { in: [...new Set(practiceRows.map(row => row.practiceId))] } },
            select: { id: true, name: true, nodes: { select: { id: true, parentId: true } } },
        });
        practices = new Map(trees.map(practice => {
            const parents = new Set(practice.nodes.map(node => node.parentId));
            return [practice.id, { name: practice.name, leafIds: practice.nodes.filter(node => !parents.has(node.id)).map(node => node.id) }];
        }));
    }

    const activity = new Map<string, GoalActivity>(userIds.map(id => [id, { puzzleAttempts: [], practiceAttempts: [], playSessions: [] }]));
    for (const row of puzzleRows) {
        const attempt: GoalPuzzleAttempt = { success: row.success, challengePoints: row.challengePoints, createdAt: row.createdAt, tags: row.puzzle.tags };
        activity.get(row.userId)?.puzzleAttempts.push(attempt);
    }
    for (const { userId, ...attempt } of practiceRows) activity.get(userId)?.practiceAttempts.push(attempt as PracticeAttemptRecord);
    for (const { userId, ...session } of playRows) activity.get(userId)?.playSessions.push(session as PlaySessionRecord);

    for (const [userId, entry] of activity) values.set(userId, goalValue(goal, entry, practices));
    return values;
}
