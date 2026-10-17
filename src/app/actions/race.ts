"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { loadPuzzleLadder } from "@/lib/puzzleQueries";
import { streakStart } from "@/lib/puzzleLadder";
import { findRace } from "@/lib/raceState";
import {
    COUNTDOWN_SECONDS, DUEL_SECONDS, LATE_GRACE_MS, MAX_RACERS, RACE_PUZZLES, RACE_SECONDS,
    applyRaceEvent, racePhase, randomRaceCode, type RaceEvent,
} from "@/lib/puzzleRace";

// Difficulty presets a coach can pick for a club race (start rating; the ladder climbs from there).
const RACE_LEVELS = { easy: 600, medium: 1000, hard: 1400 } as const;
const RACE_STEP = 15;

async function requireUser() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user;
}

async function unusedCode() {
    for (let attempt = 0; attempt < 30; attempt++) {
        const code = randomRaceCode();
        const latest = await findRace(code);
        if (!latest || racePhase(latest, new Date()) === "finished") return code;
    }
    throw new Error("No free race code, please try again");
}

export async function createRace(input: { mode: "RACE" | "DUEL"; level?: keyof typeof RACE_LEVELS; tag?: string }): Promise<{ code: string }> {
    const user = await requireUser();
    if (input.mode === "RACE" && user.role !== "COACH") throw new Error("Only coaches can host a club race");
    const start = input.mode === "RACE"
        ? RACE_LEVELS[input.level ?? "easy"] ?? RACE_LEVELS.easy
        : streakStart((await prisma.user.findUnique({ where: { id: user.id! }, select: { ratingPuzzle: true } }))?.ratingPuzzle);
    const puzzles = await loadPuzzleLadder({ start, step: RACE_STEP, count: RACE_PUZZLES, tags: input.tag ? [input.tag] : undefined });
    if (puzzles.length < 10) throw new Error("Not enough puzzles for this choice");
    const code = await unusedCode();
    await prisma.puzzleRace.create({
        data: {
            code,
            hostId: user.id!,
            mode: input.mode,
            puzzleIds: puzzles.map(puzzle => puzzle.id),
            durationSec: input.mode === "RACE" ? RACE_SECONDS : DUEL_SECONDS,
            // The child who starts a duel races in it.
            entries: input.mode === "DUEL" ? { create: { userId: user.id! } } : undefined,
        },
    });
    return { code };
}

export async function joinRace(code: string): Promise<{ ok: true } | { ok: false; reason: "notFound" | "started" | "full" }> {
    const user = await requireUser();
    const race = await findRace(code.trim());
    if (!race) return { ok: false, reason: "notFound" };
    if (race.entries.some(entry => entry.userId === user.id)) return { ok: true };
    if (racePhase(race, new Date()) !== "waiting") return { ok: false, reason: "started" };
    const limit = race.mode === "DUEL" ? 2 : MAX_RACERS;
    if (race.entries.length >= limit) return { ok: false, reason: "full" };
    await prisma.puzzleRaceEntry.create({ data: { raceId: race.id, userId: user.id! } });
    return { ok: true };
}

export async function startRace(code: string) {
    const user = await requireUser();
    const race = await findRace(code);
    if (!race || race.hostId !== user.id) throw new Error("Only the host can start the race");
    if (racePhase(race, new Date()) !== "waiting") return;
    if (race.entries.length < (race.mode === "DUEL" ? 2 : 1)) throw new Error("Wait for racers to join");
    const startsAt = new Date(Date.now() + COUNTDOWN_SECONDS * 1000);
    await prisma.puzzleRace.update({
        where: { id: race.id },
        data: { startsAt, endsAt: new Date(startsAt.getTime() + race.durationSec * 1000) },
    });
}

export async function submitRaceEvent(code: string, event: RaceEvent): Promise<boolean> {
    const user = await requireUser();
    const race = await findRace(code);
    if (!race?.startsAt || !race.endsAt) return false;
    const now = Date.now();
    if (now < race.startsAt.getTime() || now > race.endsAt.getTime() + LATE_GRACE_MS) return false;
    const entry = race.entries.find(item => item.userId === user.id);
    if (!entry) return false;
    const next = applyRaceEvent(entry, event, race.puzzleIds.length);
    if (!next) return false;
    // Only applies if no other answer for this racer was saved in between.
    const updated = await prisma.puzzleRaceEntry.updateMany({
        where: { raceId: race.id, userId: user.id!, nextIndex: entry.nextIndex },
        data: { nextIndex: next.nextIndex, score: next.score, solved: next.solved, combo: next.combo, bonuses: next.bonuses, skipped: next.skipped },
    });
    return updated.count === 1;
}

// A new race with the same settings; everyone in the old one sees a "join the rematch" button.
export async function createRematch(code: string): Promise<{ code: string }> {
    const user = await requireUser();
    const race = await findRace(code);
    if (!race || race.hostId !== user.id) throw new Error("Only the host can start a rematch");
    if (race.nextRaceId) {
        const existing = await prisma.puzzleRace.findUnique({ where: { id: race.nextRaceId }, select: { code: true } });
        if (existing) return existing;
    }
    const sorted = await prisma.puzzle.findMany({ where: { id: { in: race.puzzleIds } }, select: { rating: true } });
    const start = sorted.length ? Math.min(...sorted.map(puzzle => puzzle.rating)) : 600;
    const puzzles = await loadPuzzleLadder({ start, step: RACE_STEP, count: RACE_PUZZLES });
    const newCode = await unusedCode();
    const rematch = await prisma.puzzleRace.create({
        data: {
            code: newCode,
            hostId: user.id!,
            mode: race.mode,
            puzzleIds: puzzles.map(puzzle => puzzle.id),
            durationSec: race.durationSec,
            entries: race.mode === "DUEL" ? { create: { userId: user.id! } } : undefined,
        },
    });
    await prisma.puzzleRace.update({ where: { id: race.id }, data: { nextRaceId: rematch.id } });
    return { code: newCode };
}
