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

    // Check specific node
    const nodeId = 'cmkqil59p00cb9adfjsdgb24b';
    
    console.log(`Checking node: ${nodeId}`);

    // Get all attempts for this node
    const attempts = await prisma.practiceAttempt.findMany({
      where: {
        userId: user.id,
        nodeId: nodeId
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`\nAll attempts for this node (${attempts.length}):`);
    attempts.forEach(attempt => {
      console.log(`${attempt.createdAt.toISOString()} - Status: ${attempt.status}`);
    });

    // Get current progress
    const progress = await prisma.practiceLineProgress.findFirst({
      where: {
        userId: user.id,
        nodeId: nodeId
      },
      select: {
        id: true,
        status: true,
        perfectCount: true,
        attempts: true,
        lastAttemptAt: true
      }
    });

    console.log(`\nCurrent progress:`);
    console.log(`Status: ${progress?.status}`);
    console.log(`Perfect count: ${progress?.perfectCount}`);
    console.log(`Total attempts: ${progress?.attempts}`);
    console.log(`Last attempt at: ${progress?.lastAttemptAt?.toISOString()}`);

    // Check if last attempt was perfect but status is not PERFECT
    if (attempts.length > 0) {
      const lastAttempt = attempts[attempts.length - 1];
      console.log(`\nLast attempt:`);
      console.log(`Created: ${lastAttempt.createdAt.toISOString()}`);
      console.log(`Status: ${lastAttempt.status}`);
      
      if (lastAttempt.status === 'PERFECT' && progress?.status !== 'PERFECT') {
        console.log(`\n❌ DISCREPANCY: Last attempt was PERFECT but progress status is ${progress?.status}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
