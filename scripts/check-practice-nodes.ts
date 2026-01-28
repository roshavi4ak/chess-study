import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Vienna Gambit practice
  const practice = await prisma.practice.findFirst({
    where: { name: { contains: 'Vienna' } },
    include: { nodes: true }
  });

  if (!practice) {
    console.log('Vienna Gambit practice not found');
    return;
  }

  console.log(`Practice: ${practice.name} (${practice.id})`);
  console.log(`Total nodes: ${practice.nodes.length}`);
  
  const leafNodes = practice.nodes.filter(n => n.lineNumber !== null);
  console.log(`Leaf nodes (with lineNumber): ${leafNodes.length}`);
  
  console.log('\nLeaf nodes:');
  leafNodes.forEach(node => {
    console.log(`  Line ${node.lineNumber}: ${node.move} (${node.fen.substring(0, 50)}...)`);
  });

  // Also check progress for this practice
  const progress = await prisma.practiceLineProgress.findMany({
    where: { practiceId: practice.id },
    include: { node: true }
  });

  console.log(`\nProgress entries: ${progress.length}`);
  progress.forEach(p => {
    console.log(`  ${p.userId.substring(0, 8)}... - Status: ${p.status} - Node lineNumber: ${p.node.lineNumber}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
