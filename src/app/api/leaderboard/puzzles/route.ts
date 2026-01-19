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
            ? { createdAt: { gte: weekAgo } }
            : {};

        // Get leaderboard data for puzzles
        const leaderboard = await prisma.puzzleAttempt.groupBy({
            by: ["userId"],
            where: {
                success: true,
                ...whereClause,
            },
            _count: {
                _all: true, // Count of successful attempts
            },
            _sum: {
                points: true,
            },
            orderBy: [
                { _sum: { points: "desc" } },
                { _count: { _all: "desc" } },
            ],
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
                solvedCount: entry._count._all,
                points: entry._sum.points || 0,
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching puzzles leaderboard:", error);
        return NextResponse.json(
            { error: "Failed to fetch leaderboard" },
            { status: 500 }
        );
    }
}