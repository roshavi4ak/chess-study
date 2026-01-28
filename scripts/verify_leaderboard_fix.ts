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

    // Get current week start (Monday 00:00:00)
    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    // Get weekly practice attempts with createdAt
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

    // Calculate using the original method
    const originalCompletedNodes = new Set(weeklyAttempts.map(a => a.nodeId));
    const originalPerfectedNodes = new Set(
      weeklyAttempts.filter(a => a.status === 'PERFECT').map(a => a.nodeId)
    );

    // Calculate using the fixed method
    const nodeLastAttemptMap = new Map();
    weeklyAttempts.forEach(attempt => {
        const existing = nodeLastAttemptMap.get(attempt.nodeId);
        if (!existing || attempt.createdAt > existing.createdAt) {
            nodeLastAttemptMap.set(attempt.nodeId, attempt);
        }
    });

    const fixedCompletedNodes = new Set();
    const fixedPerfectedNodes = new Set();
    
    nodeLastAttemptMap.forEach(attempt => {
        if (attempt.status === "COMPLETED" || attempt.status === "PERFECT") {
            fixedCompletedNodes.add(attempt.nodeId);
        }
        if (attempt.status === "PERFECT") {
            fixedPerfectedNodes.add(attempt.nodeId);
        }
    });

    console.log(`=== Original Leaderboard Calculation ===`);
    console.log(`Completed lines: ${originalCompletedNodes.size}`);
    console.log(`Perfected lines: ${originalPerfectedNodes.size}`);

    console.log(`\n=== Fixed Leaderboard Calculation ===`);
    console.log(`Completed lines: ${fixedCompletedNodes.size}`);
    console.log(`Perfected lines: ${fixedPerfectedNodes.size}`);

    console.log(`\n=== Discrepancy Fixed ===`);
    if (fixedPerfectedNodes.size === 20) {
        console.log('✅ Weekly perfected lines now matches all-time perfected lines (20)');
    } else {
        console.log(`❌ Weekly perfected lines (${fixedPerfectedNodes.size}) still doesn't match all-time (20)`);
    }

    console.log(`\n=== Details ===`);
    const originalPerfectedArray = Array.from(originalPerfectedNodes);
    const fixedPerfectedArray = Array.from(fixedPerfectedNodes);
    
    const removedNodes = originalPerfectedArray.filter(node => !fixedPerfectedArray.includes(node));
    if (removedNodes.length > 0) {
        console.log(`Nodes removed from perfected count: ${removedNodes.length}`);
        removedNodes.forEach(node => {
            const lastAttempt = weeklyAttempts.filter(a => a.nodeId === node)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
            console.log(`- Node ${node.slice(0, 8)}: Last attempt status = ${lastAttempt.status}`);
        });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
