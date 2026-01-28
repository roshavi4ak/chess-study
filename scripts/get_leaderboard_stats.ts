import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const startDate = new Date('2026-01-19');
  const endDate = new Date('2026-01-26'); // Exclusive end date, so this will include up to 25th Jan
  console.log(`Analyzing data from ${startDate.toISOString()} to ${new Date(endDate.getTime() - 1).toISOString()}`);

  console.log('\n1. Finding user with most points in puzzle solving (excluding coaches):');
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
    take: 1
  });

  if (puzzlePointsResult.length > 0) {
    const topPuzzleUser = await prisma.user.findUnique({
      where: { id: puzzlePointsResult[0].userId },
      select: {
        id: true,
        name: true,
        email: true,
        lichessId: true,
        role: true
      }
    });

    console.log('Top Puzzle Solver:');
    console.log(`  Name: ${topPuzzleUser?.name || 'N/A'}`);
    console.log(`  Email: ${topPuzzleUser?.email || 'N/A'}`);
    console.log(`  Lichess ID: ${topPuzzleUser?.lichessId || 'N/A'}`);
    console.log(`  Role: ${topPuzzleUser?.role}`);
    console.log(`  Points Earned: ${puzzlePointsResult[0]._sum.points}`);
  } else {
    console.log('No puzzle attempts found');
  }

  console.log('\n2. Finding user with most perfected practice lines (excluding coaches):');
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
    take: 1
  });

  if (perfectedPracticesResult.length > 0) {
    const topPerfectPracticesUser = await prisma.user.findUnique({
      where: { id: perfectedPracticesResult[0].userId },
      select: {
        id: true,
        name: true,
        email: true,
        lichessId: true,
        role: true
      }
    });

    console.log('Top Perfect Practices:');
    console.log(`  Name: ${topPerfectPracticesUser?.name || 'N/A'}`);
    console.log(`  Email: ${topPerfectPracticesUser?.email || 'N/A'}`);
    console.log(`  Lichess ID: ${topPerfectPracticesUser?.lichessId || 'N/A'}`);
    console.log(`  Role: ${topPerfectPracticesUser?.role}`);
    console.log(`  Perfect Lines: ${perfectedPracticesResult[0]._count.userId}`);
  } else {
    console.log('No perfect practice lines found');
  }

  console.log('\nAnalysis complete');
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
