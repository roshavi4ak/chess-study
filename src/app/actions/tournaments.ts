"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { fetchTournamentInfo, fetchTournamentResults, parseTournamentUrl, tournamentUrl, type TournamentResult } from "@/lib/lichessTournaments";

// Finished tournaments stay on the page for this long.
const HISTORY_DAYS = 60;

async function requireCoach() {
    const session = await auth();
    if (session?.user?.role !== "COACH" || !session.user.id) throw new Error("Unauthorized");
    return session.user.id;
}

export async function addTournament(url: string): Promise<{ ok: true } | { ok: false; reason: "badLink" | "notFound" | "duplicate" }> {
    const coachId = await requireCoach();
    const parsed = parseTournamentUrl(url);
    if (!parsed) return { ok: false, reason: "badLink" };
    let info;
    try {
        info = await fetchTournamentInfo(parsed.kind, parsed.lichessId);
    } catch {
        return { ok: false, reason: "notFound" };
    }
    try {
        await prisma.clubTournament.create({ data: { ...parsed, ...info, createdBy: coachId } });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, reason: "duplicate" };
        throw error;
    }
    revalidatePath("/[locale]/tournaments", "page");
    return { ok: true };
}

export async function removeTournament(id: string) {
    await requireCoach();
    await prisma.clubTournament.delete({ where: { id } });
    revalidatePath("/[locale]/tournaments", "page");
}

// Once a tournament has ended: store club members' results and give each of them a play session.
async function settle(tournament: { id: string; kind: "ARENA" | "SWISS"; lichessId: string; startsAt: Date; finishesAt: Date | null; finished: boolean; results: Prisma.JsonValue }) {
    if (tournament.results) return;
    const info = tournament.finished ? null : await fetchTournamentInfo(tournament.kind, tournament.lichessId);
    if (info && !info.finished) return;
    const all = await fetchTournamentResults(tournament.kind, tournament.lichessId);
    const members = await prisma.user.findMany({ where: { lichessId: { in: all.map(row => row.lichessId) } }, select: { id: true, lichessId: true } });
    const byLichess = new Map(members.map(member => [member.lichessId!.toLowerCase(), member.id]));
    const club = all.filter(row => byLichess.has(row.lichessId));
    const claimed = await prisma.clubTournament.updateMany({
        where: { id: tournament.id, results: { equals: Prisma.DbNull } },
        data: { finished: true, results: club as unknown as Prisma.InputJsonValue, finishesAt: info?.finishesAt ?? tournament.finishesAt ?? new Date() },
    });
    if (claimed.count !== 1 || !club.length) return;
    const bestClubRank = Math.min(...club.map(row => row.rank));
    await prisma.playSession.createMany({
        data: club.map(row => ({
            userId: byLichess.get(row.lichessId)!,
            kind: "TOURNAMENT" as const,
            key: `tournament:${tournament.id}`,
            score: Math.max(0, Math.round(row.score)),
            won: row.rank === bestClubRank,
            details: { rank: row.rank },
            // Counts on the day the tournament was played.
            createdAt: info?.finishesAt ?? tournament.finishesAt ?? tournament.startsAt,
        })),
    });
}

export interface TournamentView {
    id: string;
    name: string;
    url: string;
    startsAt: string;
    status: "upcoming" | "playing" | "finished";
    results: (TournamentResult & { name: string | null })[] | null;
}

export async function getTournaments(): Promise<{ list: TournamentView[]; canEdit: boolean } | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    try {
        const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
        const rows = await prisma.clubTournament.findMany({ where: { startsAt: { gte: since } }, orderBy: { startsAt: "asc" } });
        const now = Date.now();
        // Settle tournaments that should be over; Lichess problems just leave them for the next visit.
        for (const row of rows.filter(item => !item.results && (item.finished || (item.finishesAt ?? item.startsAt).getTime() < now))) {
            await settle(row).catch(error => console.error("[Tournaments] Could not settle", row.lichessId, error));
        }
        const fresh = await prisma.clubTournament.findMany({ where: { startsAt: { gte: since } }, orderBy: { startsAt: "asc" } });
        const ids = fresh.flatMap(row => ((row.results as unknown as TournamentResult[] | null) ?? []).map(result => result.lichessId));
        const names = new Map((await prisma.user.findMany({ where: { lichessId: { in: ids } }, select: { lichessId: true, name: true } }))
            .map(user => [user.lichessId!.toLowerCase(), user.name]));
        return {
            canEdit: session.user.role === "COACH",
            list: fresh.map(row => ({
                id: row.id,
                name: row.name,
                url: tournamentUrl(row.kind, row.lichessId),
                startsAt: row.startsAt.toISOString(),
                status: row.results || row.finished ? "finished" : row.startsAt.getTime() > now ? "upcoming" : "playing",
                results: row.results ? (row.results as unknown as TournamentResult[]).map(result => ({ ...result, name: names.get(result.lichessId) ?? null })) : null,
            })),
        };
    } catch (error) {
        // Usually the ClubTournament table does not exist yet.
        console.error("[Tournaments] Could not load tournaments:", error);
        return null;
    }
}

// Club tournaments a child has played (for tournament cards).
export async function countMyTournaments(): Promise<number> {
    const session = await auth();
    if (!session?.user?.id) return 0;
    return prisma.playSession.count({ where: { userId: session.user.id, kind: "TOURNAMENT" } }).catch(() => 0);
}
