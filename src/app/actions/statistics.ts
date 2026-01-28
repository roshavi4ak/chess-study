"use server";

import { prisma } from "@/lib/db";

export interface WeeklyWinner {
  name: string;
  points: number;
  lichessId: string | null;
  image: string | null;
}

export interface AllTimeWinner {
  name: string;
  weeklyWins: number;
  lichessId: string | null;
  image: string | null;
}

export async function getWeeklyStatistics() {
  const startDate = new Date('2026-01-19');
  const endDate = new Date('2026-01-26'); // Exclusive end date, includes up to 25th Jan

  // Get top 3 weekly puzzle winners
  const puzzlePointsResult = await prisma.puzzleAttempt.groupBy({
    by: ['userId'],
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate
      },
      success: true,
      user: {
        role: 'STUDENT'
      }
    },
    _sum: {
      points: true
    },
    orderBy: {
      _sum: {
        points: 'desc'
      }
    },
    take: 3
  });

  const puzzleWinners: WeeklyWinner[] = [];
  for (const result of puzzlePointsResult) {
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: {
        name: true,
        lichessId: true,
        image: true
      }
    });
    puzzleWinners.push({
      name: user?.name || 'Anonymous',
      points: result._sum.points || 0,
      lichessId: user?.lichessId || null,
      image: user?.image || null
    });
  }

  // Get top 3 weekly perfect practice lines winners
  const perfectedPracticesResult = await prisma.practiceLineProgress.groupBy({
    by: ['userId'],
    where: {
      status: 'PERFECT',
      lastAttemptAt: {
        gte: startDate,
        lt: endDate
      },
      user: {
        role: 'STUDENT'
      }
    },
    _count: {
      userId: true
    },
    orderBy: {
      _count: {
        userId: 'desc'
      }
    },
    take: 3
  });

  const practiceWinners: WeeklyWinner[] = [];
  for (const result of perfectedPracticesResult) {
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: {
        name: true,
        lichessId: true,
        image: true
      }
    });
    practiceWinners.push({
      name: user?.name || 'Anonymous',
      points: result._count.userId,
      lichessId: user?.lichessId || null,
      image: user?.image || null
    });
  }

  return {
    puzzleWinners,
    practiceWinners
  };
}

export async function getAllTimeWinners() {
  // Calculate weekly wins based on actual weekly winner data
  // A user gets a "win" for being the top 1 puzzle winner OR top 1 practice winner for any given week
  // Only counts COMPLETED weeks (excludes current/ongoing week)
  
  const startDate = new Date('2026-01-19');
  const today = new Date();
  
  // Calculate the start of the current week (Monday)
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - daysSinceMonday);
  currentWeekStart.setHours(0, 0, 0, 0);
  
  // Generate weekly date ranges from Jan 19th to the start of current week (completed weeks only)
  const weeks: { start: Date; end: Date }[] = [];
  let weekStart = new Date(startDate);
  
  while (weekStart < currentWeekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weeks.push({ start: new Date(weekStart), end: weekEnd });
    weekStart = new Date(weekEnd);
  }
  
  // Track winners by userId
  const winnerCounts = new Map<string, { count: number; userIds: Set<string> }>();
  const userInfoMap = new Map<string, { name: string | null; lichessId: string | null; image: string | null }>();
  
  // For each week, find the top 1 puzzle winner and top 1 practice winner
  for (const week of weeks) {
    // Get top 1 puzzle winner for this week
    const puzzleWinners = await prisma.puzzleAttempt.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: week.start, lt: week.end },
        success: true,
        user: { role: 'STUDENT' }
      },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 1
    });
    
    // Get top 1 practice winner for this week
    const practiceWinners = await prisma.practiceLineProgress.groupBy({
      by: ['userId'],
      where: {
        status: 'PERFECT',
        lastAttemptAt: { gte: week.start, lt: week.end },
        user: { role: 'STUDENT' }
      },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 1
    });
    
    // Track puzzle winners
    for (const winner of puzzleWinners) {
      if (!winnerCounts.has(winner.userId)) {
        winnerCounts.set(winner.userId, { count: 0, userIds: new Set() });
      }
      winnerCounts.get(winner.userId)!.count++;
    }
    
    // Track practice winners
    for (const winner of practiceWinners) {
      if (!winnerCounts.has(winner.userId)) {
        winnerCounts.set(winner.userId, { count: 0, userIds: new Set() });
      }
      winnerCounts.get(winner.userId)!.count++;
    }
  }
  
  // Fetch user info for all winners
  const winnerUserIds = Array.from(winnerCounts.keys());
  if (winnerUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: winnerUserIds } },
      select: { id: true, name: true, lichessId: true, image: true }
    });
    
    for (const user of users) {
      userInfoMap.set(user.id, {
        name: user.name,
        lichessId: user.lichessId,
        image: user.image
      });
    }
  }
  
  // Convert to AllTimeWinner format
  const allTimeWinners: AllTimeWinner[] = winnerUserIds.map(userId => {
    const info = userInfoMap.get(userId);
    return {
      name: info?.name || 'Anonymous',
      weeklyWins: winnerCounts.get(userId)?.count || 0,
      lichessId: info?.lichessId || null,
      image: info?.image || null
    };
  }).sort((a, b) => b.weeklyWins - a.weeklyWins);
  
  // Filter out users with 0 weekly wins (shouldn't happen, but just in case)
  return allTimeWinners.filter(winner => winner.weeklyWins > 0);
}
