"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { LineStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

interface SaveLineProgressParams {
    practiceId: string;
    nodeId: string;  // ID of the leaf node
    hadWrongMoves: boolean;
    completed: boolean;
}

export async function saveLineProgress(params: SaveLineProgressParams) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const { practiceId, nodeId, hadWrongMoves, completed } = params;

    // Determine status
    let status: LineStatus;
    if (completed && !hadWrongMoves) {
        status = "PERFECT";
    } else if (completed && hadWrongMoves) {
        status = "COMPLETED";
    } else {
        status = "PARTIAL";
    }

    // Upsert the progress record
    const existing = await prisma.practiceLineProgress.findUnique({
        where: {
            userId_practiceId_nodeId: {
                userId: session.user.id,
                practiceId,
                nodeId,
            },
        },
    });

    // Use a transaction to update progress and record attempt
    // Status is always based on the LAST attempt result (not preserved from previous attempts)
    await prisma.$transaction([
        existing
            ? prisma.practiceLineProgress.update({
                where: { id: existing.id },
                data: {
                    status, // Always use the result of this attempt
                    attempts: existing.attempts + 1,
                    perfectCount: status === "PERFECT" ? existing.perfectCount + 1 : existing.perfectCount,
                    lastAttemptAt: new Date(),
                },
            })
            : prisma.practiceLineProgress.create({
                data: {
                    userId: session.user.id,
                    practiceId,
                    nodeId,
                    status,
                    attempts: 1,
                    perfectCount: status === "PERFECT" ? 1 : 0,
                    lastAttemptAt: new Date(),
                },
            }),
        prisma.practiceAttempt.create({
            data: {
                userId: session.user.id,
                practiceId,
                nodeId,
                status,
            }
        })
    ]);

    revalidatePath(`/practices/${practiceId}`);
}

// Get all progress for a practice (for determining which lines to avoid)
export async function getPracticeProgress(practiceId: string) {
    const session = await auth();

    if (!session?.user?.id) {
        return [];
    }

    const progress = await prisma.practiceLineProgress.findMany({
        where: {
            userId: session.user.id,
            practiceId,
        },
    });

    return progress;
}

// Get overall student stats
export async function getStudentStats() {
    const session = await auth();

    if (!session?.user?.id) {
        return null;
    }

    const [practiceStats, openingStats, gameCount] = await Promise.all([
        prisma.practiceLineProgress.groupBy({
            by: ['status'],
            where: { userId: session.user.id },
            _count: true,
        }),
        prisma.openingProgress.aggregate({
            where: { userId: session.user.id },
            _count: true,
            _sum: { viewCount: true },
        }),
        prisma.gameRecord.count({
            where: { userId: session.user.id },
        }),
    ]);

    return {
        practiceStats,
        openingsStudied: openingStats._count,
        totalOpeningViews: openingStats._sum.viewCount || 0,
        gamesPlayed: gameCount,
    };
}

// Record a game played
export async function recordGame(params: {
    lichessGameId: string;
    opponentId?: string;
    opponentName?: string;
    playerColor: "WHITE" | "BLACK";
    result?: string;
    openingName?: string;
}) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    // Check if game already recorded
    const existing = await prisma.gameRecord.findFirst({
        where: {
            userId: session.user.id,
            lichessGameId: params.lichessGameId,
        },
    });

    if (existing) {
        return existing;
    }

    return await prisma.gameRecord.create({
        data: {
            userId: session.user.id,
            lichessGameId: params.lichessGameId,
            opponentId: params.opponentId,
            opponentName: params.opponentName,
            playerColor: params.playerColor,
            result: params.result,
            openingName: params.openingName,
        },
    });
}

// Track opening view
export async function trackOpeningView(openingId: string, completed: boolean = false) {
    const session = await auth();

    if (!session?.user?.id) {
        return;
    }

    const existing = await prisma.openingProgress.findUnique({
        where: {
            userId_openingId: {
                userId: session.user.id,
                openingId,
            },
        },
    });

    if (existing) {
        await prisma.openingProgress.update({
            where: { id: existing.id },
            data: {
                viewCount: existing.viewCount + 1,
                lastViewedAt: new Date(),
                completed: completed || existing.completed,
            },
        });
    } else {
        await prisma.openingProgress.create({
            data: {
                userId: session.user.id,
                openingId,
                viewCount: 1,
                lastViewedAt: new Date(),
                completed,
            },
        });
    }

    console.log(`[Progress] Tracked opening view for ${openingId}, user ${session.user.id}`);
    revalidatePath(`/openings/${openingId}`);
}
