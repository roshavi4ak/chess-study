"use server";

import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getLichessAccessToken() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            provider: "lichess",
        },
    });

    return account?.access_token || null;
}

export async function getCurrentUserLichessId() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
        where: {
            id: session.user.id,
        },
        select: {
            lichessId: true,
        },
    });

    return user?.lichessId || null;
}
