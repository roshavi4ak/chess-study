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

    let allLeaderboardData: LeaderboardEntry[] = [];
    const batchSize = 50; // Batching students to avoid huge memory spikes
    let skip = 0;

    while (true) {
        // (1) Scope nested selects with date filters
        // (2) Replace full-row selects with DB-side aggregations where possible (_count)
        // (3) Adding pagination to the top-level query (batched)
        const students = await prisma.user.findMany({
            where: {
                role: "STUDENT",
                lichessId: {
                    notIn: excludedLichessIds,
                }
            },
            take: batchSize,
            skip: skip,
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
                        nodeId: true
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

        if (students.length === 0) break;

        // DB-side aggregation for all-time points using groupBy for current batch
        const studentIds = students.map(s => s.id);
        const puzzlePointsSum = await prisma.puzzleAttempt.groupBy({
            by: ['userId'],
            where: {
                userId: { in: studentIds },
                success: true
            },
            _sum: {
                points: true
            }
        });

        const pointsMap = new Map(puzzlePointsSum.map(p => [p.userId, p._sum.points || 0]));

        const batchProcessed = students.map(student => {
            // Weekly Puzzles (Aggregated in memory from filtered rows)
            const weeklySuccessful = student.puzzleAttempts.filter(a => a.success);
            const weeklyPuzzlePoints = weeklySuccessful.reduce((sum, a) => sum + (a.points ?? 0), 0);

            // Weekly Openings (Calculate unique completed/perfected nodes this week)
            const weeklyCompletedNodes = new Set(student.practiceAttempts.map(a => a.nodeId));
            const weeklyPerfectedNodes = new Set(
                student.practiceAttempts
                    .filter(a => a.status === "PERFECT")
                    .map(a => a.nodeId)
            );

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

        allLeaderboardData.push(...batchProcessed);

        if (students.length < batchSize) break;
        skip += batchSize;
    }

    return allLeaderboardData;
}
