import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all"; // "weekly" or "all"

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const whereClause: any = {
        completed: true,
    };

    if (period === "weekly") {
        whereClause.updatedAt = {
            gte: weekAgo,
        };
    }

    const rankings = await prisma.openingProgress.groupBy({
        by: ["userId"],
        where: whereClause,
        _count: {
            id: true,
        },
        orderBy: {
            _count: {
                id: "desc",
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
        completedCount: r._count.id,
    }));

    return NextResponse.json(result);
}