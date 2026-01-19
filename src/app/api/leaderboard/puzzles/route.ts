import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all"; // "weekly" or "all"

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const whereClause: any = {
        success: true,
    };

    if (period === "weekly") {
        whereClause.createdAt = {
            gte: weekAgo,
        };
    }

    const rankings = await prisma.puzzleAttempt.groupBy({
        by: ["userId"],
        where: whereClause,
        _count: {
            id: true,
        },
        _sum: {
            points: true,
        },
        orderBy: {
            _sum: {
                points: "desc",
            },
        },
        take: 10,
    });

    // Get user names
    const userIds = rankings.map(r => r.userId);
    const users = await prisma.user.findMany({
        where: {
            id: {
                in: userIds,
            },
        },
        select: {
            id: true,
            name: true,
        },
    });

    const userMap = new Map(users.map(u => [u.id, u.name]));

    const result = rankings.map(r => ({
        userId: r.userId,
        name: userMap.get(r.userId) || "Unknown",
        solvedCount: r._count.id,
        points: r._sum.points || 0,
    }));

    return NextResponse.json(result);
}