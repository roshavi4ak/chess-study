import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find ALL practices with "Vienna" in the name
  const practices = await prisma.practice.findMany({
    where: { name: { contains: 'Vienna', mode: 'insensitive' } },
    include: { 
      nodes: { 
        where: { lineNumber: { not: null } },
        orderBy: { lineNumber: 'asc' }
      },
      _count: { select: { progress: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${practices.length} practices with "Vienna" in name:\n`);

  for (const p of practices) {
    console.log(`=== ${p.name} ===`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Nodes with lineNumbers: ${p.nodes.length}`);
    console.log(`  Progress entries: ${p._count.progress}`);
    
    if (p.nodes.length > 0) {
      console.log(`  Line numbers: ${p.nodes.slice(0, 10).map(n => n.lineNumber).join(', ')}${p.nodes.length > 10 ? '...' : ''}`);
    }
    console.log('');
  }

  // Also check the progress table directly
  console.log('=== Direct progress table query ===');
  const allProgress = await prisma.practiceLineProgress.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { 
      practice: { select: { name: true } },
      node: { select: { lineNumber: true, fen: true } }
    }
  });

  console.log(`Total progress entries in DB: ${await prisma.practiceLineProgress.count()}`);
  console.log('\nRecent progress entries:');
  for (const p of allProgress) {
    console.log(`  ${p.practice.name} - Line ${p.node.lineNumber ?? '?'} - Status: ${p.status} - User: ${p.userId.substring(0, 8)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
