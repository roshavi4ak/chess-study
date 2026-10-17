import { prisma } from "@/lib/db";
import { loadPuzzlesInOrder } from "@/lib/puzzleQueries";
import { racePhase, rankRacers, type RacePhase } from "@/lib/puzzleRace";
import type { LadderPuzzle } from "@/lib/puzzleLadder";

export interface RaceView {
    id: string;
    code: string;
    mode: "RACE" | "DUEL";
    phase: RacePhase;
    durationSec: number;
    startsAt: string | null;
    endsAt: string | null;
    serverNow: string;
    hostName: string | null;
    isHost: boolean;
    joined: boolean;
    nextCode: string | null;
    racers: { userId: string; name: string | null; image: string | null; score: number; solved: number; combo: number; nextIndex: number; skipped: boolean }[];
    puzzles: LadderPuzzle[] | null;
}

// The newest race with this code (codes are reused once a race is over).
export async function findRace(code: string) {
    return prisma.puzzleRace.findFirst({
        where: { code },
        orderBy: { createdAt: "desc" },
        include: {
            host: { select: { name: true } },
            entries: { include: { user: { select: { name: true, image: true } } } },
        },
    });
}

// Writes a play session for every racer once, after the race ends.
export async function recordFinishedRace(raceId: string) {
    const race = await prisma.puzzleRace.findUnique({ where: { id: raceId }, include: { entries: true } });
    if (!race || race.recorded || racePhase(race, new Date()) !== "finished") return;
    const claimed = await prisma.puzzleRace.updateMany({ where: { id: raceId, recorded: false }, data: { recorded: true } });
    if (claimed.count !== 1) return;
    const ranked = rankRacers(race.entries.map(entry => ({ ...entry, name: entry.userId })));
    const top = ranked[0]?.score ?? 0;
    const tie = ranked.filter(entry => entry.score === top).length > 1;
    await prisma.playSession.createMany({
        data: race.entries.map(entry => ({
            userId: entry.userId,
            kind: race.mode,
            key: `race:${race.id}`,
            score: entry.score,
            won: tie && entry.score === top ? null : entry.score === top && top > 0,
            details: { solved: entry.solved, racers: race.entries.length },
        })),
    });
}

export async function getRaceView(code: string, userId: string): Promise<RaceView | null> {
    const race = await findRace(code);
    if (!race) return null;
    const now = new Date();
    const phase = racePhase(race, now);
    if (phase === "finished" && !race.recorded) await recordFinishedRace(race.id);
    const joined = race.entries.some(entry => entry.userId === userId);
    const isHost = race.hostId === userId;
    const next = race.nextRaceId ? await prisma.puzzleRace.findUnique({ where: { id: race.nextRaceId }, select: { code: true } }) : null;
    return {
        id: race.id,
        code: race.code,
        mode: race.mode,
        phase,
        durationSec: race.durationSec,
        startsAt: race.startsAt?.toISOString() ?? null,
        endsAt: race.endsAt?.toISOString() ?? null,
        serverNow: now.toISOString(),
        hostName: race.host.name,
        isHost,
        joined,
        nextCode: next?.code ?? null,
        racers: rankRacers(race.entries.map(entry => ({
            userId: entry.userId,
            name: entry.user.name,
            image: entry.user.image,
            score: entry.score,
            solved: entry.solved,
            combo: entry.combo,
            nextIndex: entry.nextIndex,
            skipped: entry.skipped,
        }))),
        // Puzzles are only handed out once the race is under way, and only to its racers and host.
        puzzles: phase !== "waiting" && (joined || isHost) ? await loadPuzzlesInOrder(race.puzzleIds) : null,
    };
}
