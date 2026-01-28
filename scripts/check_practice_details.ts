import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Get all practices with their nodes
    const practices = await prisma.practice.findMany({
      include: {
        nodes: {
          orderBy: {
            lineNumber: 'asc'
          },
          select: {
            id: true,
            lineNumber: true,
            move: true,
            parentId: true,
            order: true
          }
        }
      }
    });

    console.log(`Found ${practices.length} practices`);

    for (const practice of practices) {
      console.log(`\nPractice: "${practice.name}" (ID: ${practice.id})`);
      
      // Count leaf nodes (lines)
      const leafNodes = practice.nodes.filter(node => {
        const isLeaf = practice.nodes.filter(n => n.parentId === node.id).length === 0;
        return isLeaf;
      });

      console.log(`Total nodes: ${practice.nodes.length}`);
      console.log(`Leaf nodes (lines): ${leafNodes.length}`);
      
      // Show line numbers
      if (leafNodes.length > 0) {
        console.log('Line numbers in practice:');
        leafNodes
          .filter(node => node.lineNumber !== null)
          .sort((a, b) => a.lineNumber! - b.lineNumber!)
          .forEach(node => {
            console.log(`Line ${node.lineNumber}: Node ${node.id} (Move: ${node.move})`);
          });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
