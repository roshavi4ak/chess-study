"use server";

import { prisma } from "@/lib/db";

import { LeaderboardEntry, PuzzleStats, OpeningStats } from "@/types/leaderboard";

export async function getLeaderboardData() {
    const now = new Date();
    // Manual start of week (Monday 00:00:00)
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    const excludedLichessIds = ["mi666ka", "belozem", "petar1976"];

    // Get all students
    const allStudents = await prisma.user.findMany({
        where: {
            role: "STUDENT",
            lichessId: {
                notIn: excludedLichessIds,
            }
        },
        select: { id: true }
    });

    const allUserIds = allStudents.map(s => s.id);

    // Aggregate points for all students
    const userAggregates = await prisma.puzzleAttempt.groupBy({
        by: ['userId'],
        where: {
            success: true,
            userId: { in: allUserIds }
        },
        _sum: {
            points: true
        }
    });

    const pointsMap = new Map(userAggregates.map(a => [a.userId, a._sum.points || 0]));

    // Fetch the user details for all students
    const topStudents = await prisma.user.findMany({
        where: {
            id: { in: allUserIds }
        },
        select: {
            id: true,
            name: true,
            image: true,
            _count: {
                select: {
                    puzzleAttempts: { where: { success: true } }
                }
            },
            puzzleAttempts: {
                where: { createdAt: { gte: weekStart } },
                select: {
                    success: true,
                    points: true
                }
            },
            practiceAttempts: {
                where: {
                    createdAt: { gte: weekStart },
                    status: { in: ["COMPLETED", "PERFECT"] }
                },
                select: {
                    status: true,
                    nodeId: true,
                    createdAt: true
                }
            },
            // Only pulling relevant progress rows (completed or perfected)
            practiceProgress: {
                where: { status: { in: ["COMPLETED", "PERFECT"] } },
                select: {
                    status: true
                }
            }
        }
    });

    const allLeaderboardData = topStudents.map(student => {
        // Weekly Puzzles (Aggregated in memory from filtered rows)
        const weeklySuccessful = student.puzzleAttempts.filter(a => a.success);
        const weeklyPuzzlePoints = weeklySuccessful.reduce((sum, a) => sum + (a.points ?? 0), 0);

        // Weekly Openings (Calculate unique completed/perfected nodes this week, considering only the last attempt)
        const nodeLastAttemptMap = new Map();
        student.practiceAttempts.forEach(attempt => {
            const existing = nodeLastAttemptMap.get(attempt.nodeId);
            if (!existing || attempt.createdAt > existing.createdAt) {
                nodeLastAttemptMap.set(attempt.nodeId, attempt);
            }
        });

        const weeklyCompletedNodes = new Set();
        const weeklyPerfectedNodes = new Set();
        
        nodeLastAttemptMap.forEach(attempt => {
            if (attempt.status === "COMPLETED" || attempt.status === "PERFECT") {
                weeklyCompletedNodes.add(attempt.nodeId);
            }
            if (attempt.status === "PERFECT") {
                weeklyPerfectedNodes.add(attempt.nodeId);
            }
        });

        // All Time Openings (Aggregated from filtered progress rows)
        const allTimeCompleted = student.practiceProgress.length;
        const allTimePerfected = student.practiceProgress.filter(p => p.status === "PERFECT").length;

        return {
            id: student.id,
            name: student.name,
            image: student.image,
            puzzleStats: {
                weekly: {
                    count: weeklySuccessful.length,
                    points: weeklyPuzzlePoints
                },
                allTime: {
                    count: student._count.puzzleAttempts,
                    points: pointsMap.get(student.id) || 0
                }
            },
            openingStats: {
                weekly: {
                    completed: weeklyCompletedNodes.size,
                    perfected: weeklyPerfectedNodes.size
                },
                allTime: {
                    completed: allTimeCompleted,
                    perfected: allTimePerfected
                }
            }
        };
    });

    // Sort by all-time points descending and limit to 20
    return allLeaderboardData.sort((a, b) => b.puzzleStats.allTime.points - a.puzzleStats.allTime.points).slice(0, 20);
}
