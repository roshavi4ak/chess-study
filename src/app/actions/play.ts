"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { type Prisma, type PlayKind } from "@prisma/client";
import { streakStart, STREAK_STEP, type LadderPuzzle } from "@/lib/puzzleLadder";
import { loadPuzzleLadder } from "@/lib/puzzleQueries";
import { sofiaDay, weekDays } from "@/lib/reviewSchedule";
import { getExcludedLichessIds } from "@/lib/leaderboardExclusions";

// Kinds a child's browser may record directly; races and duels are recorded by the race code itself.
const SCORE_LIMITS: Partial<Record<PlayKind, number>> = {
    STREAK: 500,
    COORDINATES: 300,
    MINIGAME: 3,
    BOT_GAME: 1,
    SOLO_CHESS: 1, // 1 = solved without help, 0 = finished with a hint
    NOTATION: 10, // correct answers in a round of ten
};

async function requireUser() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user;
}

export async function recordPlaySession(input: { kind: PlayKind; key?: string; score: number; won?: boolean; details?: Prisma.InputJsonValue }) {
    const user = await requireUser();
    const limit = SCORE_LIMITS[input.kind];
    const score = Math.round(input.score);
    if (limit === undefined) throw new Error("This activity cannot be recorded directly");
    if (!Number.isFinite(score) || score < 0 || score > limit) throw new Error("Invalid score");
    const key = (input.key ?? "").slice(0, 64);
    if (input.kind === "MINIGAME" && key.startsWith("freeplay:")) {
        // Reconnecting to the same completed game must not create another activity day.
        if (await prisma.playSession.findFirst({ where: { userId: user.id!, kind: "MINIGAME", key }, select: { id: true } })) return;
    }
    await prisma.playSession.create({
        data: { userId: user.id!, kind: input.kind, key, score, won: input.won ?? null, details: input.details },
    });
}

export type ClubRecord = { name: string | null; score: number };
type ClubRecords = { streak: ClubRecord[]; coordinates: ClubRecord[] };

export interface PersonalBests {
    streak: number;
    coordinates: number;
    // Best score per key (bot id → 1 when beaten, mini-game level id → stars).
    byKey: Record<string, number>;
    clubWeek: ClubRecords;
    clubAllTime: ClubRecords;
}

const CLUB_TOP = 5;

export async function getPersonalBests(): Promise<PersonalBests> {
    const user = await requireUser();
    const empty: PersonalBests = { streak: 0, coordinates: 0, byKey: {}, clubWeek: { streak: [], coordinates: [] }, clubAllTime: { streak: [], coordinates: [] } };
    try {
        const days = weekDays(sofiaDay(new Date()));
        // A day of margin on both sides; the exact Sofia week is filtered below.
        const since = new Date(`${days[0]}T00:00:00Z`);
        since.setUTCDate(since.getUTCDate() - 1);
        const [mine, week, allTime, excluded] = await Promise.all([
            prisma.playSession.groupBy({ by: ["kind", "key"], where: { userId: user.id! }, _max: { score: true } }),
            prisma.playSession.findMany({
                where: { kind: { in: ["STREAK", "COORDINATES"] }, createdAt: { gte: since } },
                select: { kind: true, score: true, createdAt: true, user: { select: { id: true, name: true, lichessId: true } } },
            }),
            prisma.playSession.groupBy({
                by: ["kind", "userId"],
                where: { kind: { in: ["STREAK", "COORDINATES"] } },
                _max: { score: true },
            }),
            getExcludedLichessIds(),
        ]);
        const players = await prisma.user.findMany({
            where: { id: { in: [...new Set(allTime.map(row => row.userId))] } },
            select: { id: true, name: true, lichessId: true },
        });
        const playersById = new Map(players.map(player => [player.id, player]));
        const records = allTime.flatMap(row => {
            const player = playersById.get(row.userId);
            return player ? [{ kind: row.kind, score: row._max.score ?? 0, user: player }] : [];
        });
        const result = { ...empty, byKey: {} as Record<string, number> };
        for (const row of mine) {
            const best = row._max.score ?? 0;
            if (row.kind === "STREAK") result.streak = Math.max(result.streak, best);
            else if (row.kind === "COORDINATES") result.coordinates = Math.max(result.coordinates, best);
            else if (row.key) result.byKey[row.key] = Math.max(result.byKey[row.key] ?? 0, best);
        }
        const weekSet = new Set(days);
        const hidden = new Set(excluded);
        const top = (rows: typeof records, kind: PlayKind) => {
            const bestByUser = new Map<string, { name: string | null; score: number }>();
            for (const row of rows) {
                if (row.kind !== kind || (row.user.lichessId && hidden.has(row.user.lichessId))) continue;
                const current = bestByUser.get(row.user.id);
                if (!current || row.score > current.score) bestByUser.set(row.user.id, { name: row.user.name, score: row.score });
            }
            return [...bestByUser.values()].filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, CLUB_TOP);
        };
        const thisWeek = week.filter(row => weekSet.has(sofiaDay(row.createdAt)));
        result.clubWeek = { streak: top(thisWeek, "STREAK"), coordinates: top(thisWeek, "COORDINATES") };
        result.clubAllTime = { streak: top(records, "STREAK"), coordinates: top(records, "COORDINATES") };
        return result;
    } catch (error) {
        console.error("[Play] Could not load personal bests:", error);
        return empty;
    }
}

// Puzzles of rising difficulty for unrated modes (streak, level tests).
export async function getPuzzleLadder({ start, step = STREAK_STEP, count, tags }: { start?: number; step?: number; count: number; tags?: string[] }): Promise<LadderPuzzle[]> {
    const user = await requireUser();
    const from = start ?? streakStart((await prisma.user.findUnique({ where: { id: user.id! }, select: { ratingPuzzle: true } }))?.ratingPuzzle);
    return loadPuzzleLadder({ start: from, step, count, tags });
}

// Wins against each animal bot (by bot id).
export async function getBotWins(): Promise<Record<string, number>> {
    const user = await requireUser();
    try {
        const rows = await prisma.playSession.groupBy({
            by: ["key"],
            where: { userId: user.id!, kind: "BOT_GAME", won: true },
            _count: { _all: true },
        });
        return Object.fromEntries(rows.map(row => [row.key.replace(/^bot:/, ""), row._count._all]));
    } catch (error) {
        console.error("[Play] Could not load bot wins:", error);
        return {};
    }
}

// Solo chess puzzles finished by this child: solved without help (never shown again) and finished with a hint.
export async function getSoloChessProgress(): Promise<{ solved: string[]; helped: string[] }> {
    const user = await requireUser();
    try {
        const rows = await prisma.playSession.groupBy({
            by: ["key"],
            where: { userId: user.id!, kind: "SOLO_CHESS" },
            _max: { score: true },
        });
        const id = (key: string) => key.replace(/^solo:/, "");
        return {
            solved: rows.filter(row => (row._max.score ?? 0) >= 1).map(row => id(row.key)),
            helped: rows.filter(row => (row._max.score ?? 0) < 1).map(row => id(row.key)),
        };
    } catch (error) {
        // Usually the database does not know the SOLO_CHESS kind yet.
        console.error("[Play] Could not load solo chess progress:", error);
        return { solved: [], helped: [] };
    }
}
