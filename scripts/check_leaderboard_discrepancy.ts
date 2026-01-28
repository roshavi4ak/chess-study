import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Find the user with username meliproto
    const user = await prisma.user.findFirst({
      where: { 
        lichessId: 'meliproto' 
      },
      select: {
        id: true,
        name: true,
        lichessId: true
      }
    });

    if (!user) {
      console.error('User "meliproto" not found');
      return;
    }

    console.log(`Found user: ${user.name} (ID: ${user.id})`);

    // Get current week start (Monday 00:00:00)
    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    console.log(`Week start: ${weekStart.toISOString()}`);

    // Get weekly practice attempts
    const weeklyAttempts = await prisma.practiceAttempt.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: weekStart },
        status: { in: ['COMPLETED', 'PERFECT'] }
      },
      select: {
        id: true,
        nodeId: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`\nWeekly practice attempts (${weeklyAttempts.length}):`);
    weeklyAttempts.forEach(attempt => {
      console.log(`${attempt.createdAt.toISOString().split('T')[1]} - Node: ${attempt.nodeId.slice(0, 8)} - Status: ${attempt.status}`);
    });

    // Get unique weekly completed and perfected nodes
    const weeklyCompletedNodes = new Set(weeklyAttempts.map(a => a.nodeId));
    const weeklyPerfectedNodes = new Set(
      weeklyAttempts.filter(a => a.status === 'PERFECT').map(a => a.nodeId)
    );

    console.log(`\nWeekly stats:`);
    console.log(`- Completed nodes: ${weeklyCompletedNodes.size}`);
    console.log(`- Perfected nodes: ${weeklyPerfectedNodes.size}`);

    // Get all time practice progress
    const allTimeProgress = await prisma.practiceLineProgress.findMany({
      where: {
        userId: user.id,
        status: { in: ['COMPLETED', 'PERFECT'] }
      },
      select: {
        nodeId: true,
        status: true,
        perfectCount: true,
        attempts: true
      }
    });

    console.log(`\nAll time practice progress (${allTimeProgress.length}):`);
    allTimeProgress.forEach(progress => {
      console.log(`Node: ${progress.nodeId.slice(0, 8)} - Status: ${progress.status} - Perfect count: ${progress.perfectCount}`);
    });

    const allTimeCompleted = allTimeProgress.length;
    const allTimePerfected = allTimeProgress.filter(p => p.status === 'PERFECT').length;

    console.log(`\nAll time stats:`);
    console.log(`- Completed nodes: ${allTimeCompleted}`);
    console.log(`- Perfected nodes: ${allTimePerfected}`);

    // Find discrepancies
    const discrepancyNodes = Array.from(weeklyPerfectedNodes).filter(nodeId => {
      const progress = allTimeProgress.find(p => p.nodeId === nodeId);
      return progress && progress.status !== 'PERFECT';
    });

    if (discrepancyNodes.length > 0) {
      console.log(`\nDiscrepancy found! ${discrepancyNodes.length} node(s) were perfected this week but show as completed all time:`);
      discrepancyNodes.forEach(nodeId => {
        const progress = allTimeProgress.find(p => p.nodeId === nodeId);
        const weeklyPerfectAttempts = weeklyAttempts.filter(a => a.nodeId === nodeId && a.status === 'PERFECT');
        console.log(`Node: ${nodeId.slice(0, 8)} - Perfect attempts this week: ${weeklyPerfectAttempts.length} - Current status: ${progress?.status}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
