import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Vienna Gambit
  const practice = await prisma.practice.findFirst({
    where: { name: { contains: 'Vienna' } },
    include: { nodes: true }
  });

  if (!practice) {
    console.log('Vienna Gambit not found');
    return;
  }

  console.log(`Practice: ${practice.name}`);
  console.log(`Current nodes: ${practice.nodes.length}`);

  // Find progress entries for this practice
  const progressEntries = await prisma.practiceLineProgress.findMany({
    where: { practiceId: practice.id },
    include: { node: true }
  });

  console.log(`\nProgress entries: ${progressEntries.length}`);

  // Check which entries have orphaned nodes (node no longer exists in practice)
  const currentNodeIds = new Set(practice.nodes.map(n => n.id));
  const orphanedProgress = progressEntries.filter(p => !currentNodeIds.has(p.nodeId));
  const validProgress = progressEntries.filter(p => currentNodeIds.has(p.nodeId));

  console.log(`Valid progress (node exists): ${validProgress.length}`);
  console.log(`Orphaned progress (node deleted): ${orphanedProgress.length}`);

  if (orphanedProgress.length === 0) {
    console.log('\n✓ No orphaned progress found - all progress is valid!');
    return;
  }

  // Try to recover by mapping FEN positions
  console.log('\nAttempting to recover by FEN matching...');
  
  // Build FEN -> newNode map
  const fenToNewNode = new Map<string, typeof practice.nodes[0]>();
  for (const node of practice.nodes) {
    if (node.lineNumber !== null) {
      fenToNewNode.set(node.fen, node);
    }
  }

  console.log(`New leaf nodes by FEN: ${fenToNewNode.size}`);

  // Show orphaned entries
  console.log('\nOrphaned progress entries:');
  for (const p of orphanedProgress.slice(0, 5)) {
    console.log(`  User: ${p.userId.substring(0, 8)}... Status: ${p.status} Node: ${p.nodeId.substring(0, 8)}...`);
    if (p.node) {
      console.log(`    Old FEN: ${p.node.fen.substring(0, 60)}...`);
      // Try to find matching new node
      const matchingNewNode = fenToNewNode.get(p.node.fen);
      if (matchingNewNode) {
        console.log(`    ✓ MATCH FOUND -> New node: ${matchingNewNode.id.substring(0, 8)}... Line ${matchingNewNode.lineNumber}`);
      } else {
        console.log(`    ✗ No matching FEN found in new nodes`);
      }
    }
  }

  if (orphanedProgress.length > 5) {
    console.log(`  ... and ${orphanedProgress.length - 5} more`);
  }

  // Count recoverable entries
  let recoverableCount = 0;
  for (const p of orphanedProgress) {
    if (p.node && fenToNewNode.has(p.node.fen)) {
      recoverableCount++;
    }
  }

  console.log(`\n${recoverableCount} of ${orphanedProgress.length} orphaned entries can be recovered by FEN matching`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
