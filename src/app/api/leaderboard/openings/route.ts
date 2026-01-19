import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period") || "weekly";

        // Calculate date filter for weekly
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const whereClause = period === "weekly"
            ? { updatedAt: { gte: weekAgo } }
            : {};

        // Get leaderboard data for openings (count completed openings)
        const leaderboard = await prisma.openingProgress.groupBy({
            by: ["userId"],
            where: {
                completed: true,
                ...whereClause,
            },
            _count: {
                _all: true, // Count of completed openings
            },
            orderBy: {
                _count: {
                    _all: "desc",
                },
            },
            take: 50, // Top 50
        });

        // Get user details for each entry
        const userIds = leaderboard.map(entry => entry.userId);
        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
            },
            select: {
                id: true,
                name: true,
                email: true,
            },
        });

        // Combine data
        const result = leaderboard.map(entry => {
            const user = users.find(u => u.id === entry.userId);
            return {
                userId: entry.userId,
                name: user?.name,
                email: user?.email,
                completedCount: entry._count._all,
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching openings leaderboard:", error);
        return NextResponse.json(
            { error: "Failed to fetch leaderboard" },
            { status: 500 }
        );
    }
}