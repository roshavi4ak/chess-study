"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ensureExclusionsInitialized, isLeaderboardAdmin } from "@/lib/leaderboardExclusions";

// Lichess usernames: letters, digits, "_" and "-"; ids are their lowercase form.
const LICHESS_ID = /^[a-z0-9][a-z0-9_-]{1,29}$/;

async function requireAdmin() {
    const session = await auth();
    if (!isLeaderboardAdmin(session?.user?.lichessId)) throw new Error("Unauthorized");
    return session!.user!.lichessId as string;
}

export interface ExclusionSettings {
    excluded: { lichessId: string; name: string | null; addedBy: string | null; updatedAt: Date }[];
    // Accounts that can still be hidden, for the picker.
    candidates: { lichessId: string; name: string | null }[];
}

export async function getExclusionSettings(): Promise<ExclusionSettings> {
    await requireAdmin();
    await ensureExclusionsInitialized();
    const [exclusions, users] = await Promise.all([
        prisma.leaderboardExclusion.findMany({ where: { hidden: true }, orderBy: { lichessId: "asc" } }),
        prisma.user.findMany({
            where: { lichessId: { not: null } },
            select: { lichessId: true, name: true },
            orderBy: { name: "asc" },
        }),
    ]);
    const names = new Map(users.map(user => [user.lichessId!, user.name]));
    const excluded = new Set(exclusions.map(row => row.lichessId));
    return {
        excluded: exclusions.map(row => ({ lichessId: row.lichessId, addedBy: row.addedBy, updatedAt: row.updatedAt, name: names.get(row.lichessId) ?? null })),
        candidates: users.filter(user => !excluded.has(user.lichessId!)).map(user => ({ lichessId: user.lichessId!, name: user.name })),
    };
}

export async function addExclusion(rawLichessId: string) {
    const changedBy = await requireAdmin();
    const lichessId = rawLichessId.trim().toLowerCase();
    if (!LICHESS_ID.test(lichessId)) throw new Error("Invalid Lichess username");
    await ensureExclusionsInitialized();
    await prisma.leaderboardExclusion.upsert({
        where: { lichessId },
        update: { hidden: true, addedBy: changedBy },
        create: { lichessId, addedBy: changedBy },
    });
    revalidatePath("/[locale]/leaderboard", "layout");
}

// Keeps the row (hidden = false) so the original list is never filled in again.
export async function removeExclusion(lichessId: string) {
    const changedBy = await requireAdmin();
    await prisma.leaderboardExclusion.updateMany({ where: { lichessId }, data: { hidden: false, addedBy: changedBy } });
    revalidatePath("/[locale]/leaderboard", "layout");
}
