"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { LineStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { Chess } from "chess.js";
import { readMoveErrors, type MoveError } from "@/lib/attemptMoves";
import { learningMove } from "@/lib/puzzleLearning";

interface SaveLineProgressParams {
    practiceId: string;
    nodeId: string;  // ID of the leaf node
    hadWrongMoves: boolean;
    mistakes?: number; // Number of wrong moves in this attempt
    moveErrors?: MoveError[];
    finalMove?: string;
    completed: boolean;
    coachNotesVisible: boolean;
}

export async function saveLineProgress(params: SaveLineProgressParams) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const { practiceId, nodeId, completed, coachNotesVisible } = params;
    if (params.finalMove !== undefined) {
        const leaf = await prisma.practiceNode.findFirst({ where: { id: nodeId, practiceId }, include: { parent: true, children: { select: { id: true } } } });
        if (!leaf?.parent || leaf.children.length) throw new Error("Unknown practice line");
        const after = new Chess(leaf.parent.fen);
        learningMove(after, params.finalMove);
        if (params.finalMove !== leaf.move && !after.isCheckmate()) throw new Error("Invalid final move");
    }
    let moveErrors: MoveError[] | undefined;
    if (params.moveErrors !== undefined) {
        moveErrors = readMoveErrors(params.moveErrors);
        if (moveErrors.length !== params.moveErrors.length || moveErrors.length > 1000) throw new Error("Invalid move errors");
        const nodes = await prisma.practiceNode.findMany({ where: { practiceId }, select: { id: true, parentId: true, fen: true, move: true } });
        const byId = new Map(nodes.map(node => [node.id, node]));
        if (!byId.has(nodeId)) throw new Error("Unknown practice line");
        // Validate against the practice tree; a run can branch or replay an earlier position.
        moveErrors = moveErrors.map(error => {
            const parent = nodes.find(node => node.fen === error.fen);
            const expected = nodes.filter(node => node.parentId === parent?.id && node.move && error.expected.includes(node.move)).map(node => node.move!);
            if (!parent || !expected.length) throw new Error("Invalid mistake position");
            const after = new Chess(parent.fen);
            const played = learningMove(after, error.played);
            const uci = played.from + played.to + (played.promotion ?? "");
            if (expected.includes(uci)) throw new Error("Correct move recorded as a mistake");
            return { ply: error.ply, fen: parent.fen, played: uci, expected };
        });
    }
    const hadWrongMoves = params.hadWrongMoves || !!moveErrors?.length;
    const mistakes = Math.max(hadWrongMoves ? 1 : 0, moveErrors?.length ?? 0, Math.min(1000, Math.round(params.mistakes ?? 0)));

    // Determine status
    let status: LineStatus;
    if (completed && !hadWrongMoves && !coachNotesVisible) {
        status = "PERFECT";
    } else if (completed) {
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
                mistakes,
                ...(moveErrors !== undefined ? { moveErrors } : {}),
                ...(params.finalMove ? { finalMove: params.finalMove } : {}),
                usedHints: coachNotesVisible,
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

// Every run of this practice's lines, used to pick the next line to practice
export async function getPracticeAttempts(practiceId: string) {
    const session = await auth();

    if (!session?.user?.id) {
        return [];
    }

    return await prisma.practiceAttempt.findMany({
        where: { userId: session.user.id, practiceId },
        select: { nodeId: true, status: true, createdAt: true },
        orderBy: { createdAt: "asc" },
    });
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

export async function getUserTagStats() {
    const session = await auth();

    if (!session?.user?.id) {
        return [];
    }

    return await prisma.userTagStats.findMany({
        where: { userId: session.user.id },
        orderBy: { tag: 'asc' },
    });
}
