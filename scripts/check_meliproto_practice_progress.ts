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

    // Get all practices
    const practices = await prisma.practice.findMany({
      include: {
        nodes: true,
        progress: {
          where: {
            userId: user.id
          },
          select: {
            nodeId: true,
            status: true,
            attempts: true,
            perfectCount: true
          }
        }
      }
    });

    console.log(`Found ${practices.length} practices`);

    // Check for uncompleted practice lines
    const uncompletedLines = [];

    for (const practice of practices) {
      console.log(`\nChecking practice: "${practice.name}"`);
      
      // Get all leaf nodes (lines) in this practice
      const allLines = practice.nodes.filter(node => {
        const isLeaf = practice.nodes.filter(n => n.parentId === node.id).length === 0;
        return isLeaf;
      });
      console.log(`Total lines in practice: ${allLines.length}`);

      // Get completed lines (PERFECT or COMPLETED)
      const completedLineIds = practice.progress
        .filter(p => p.status === 'PERFECT' || p.status === 'COMPLETED')
        .map(p => p.nodeId);

      // Get perfectly completed lines (PERFECT only)
      const perfectLineIds = practice.progress
        .filter(p => p.status === 'PERFECT')
        .map(p => p.nodeId);

      console.log(`Completed lines: ${completedLineIds.length}`);
      console.log(`Perfectly completed lines: ${perfectLineIds.length}`);

      // Find uncompleted lines
      const uncompleted = allLines.filter(node => !completedLineIds.includes(node.id));
      
      for (const line of uncompleted) {
        uncompletedLines.push({
          practiceId: practice.id,
          practiceName: practice.name,
          lineNumber: line.lineNumber,
          nodeId: line.id,
          fen: line.fen,
          move: line.move,
          notes: line.notes
        });
      }
    }

    // Output results
    console.log('\n=== Uncompleted Practice Lines ===');
    if (uncompletedLines.length === 0) {
      console.log('meliproto has completed all practice lines!');
    } else {
      console.log(`Found ${uncompletedLines.length} uncompleted practice lines:`);
      
      uncompletedLines.forEach(line => {
        console.log(`\nPractice: ${line.practiceName}`);
        console.log(`Line: ${line.lineNumber}`);
        console.log(`Node ID: ${line.nodeId}`);
        if (line.move) {
          console.log(`Last Move: ${line.move}`);
        }
        if (line.notes) {
          console.log(`Notes: ${line.notes}`);
        }
        console.log(`Position: ${line.fen}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
