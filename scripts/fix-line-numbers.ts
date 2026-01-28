import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPracticeLineNumbers(practiceId: string, practiceName: string) {
  console.log(`\nFixing ${practiceName}...`);
  
  // Get all nodes for this practice
  const nodes = await prisma.practiceNode.findMany({
    where: { practiceId },
    orderBy: { order: 'asc' }
  });
  
  console.log(`  Total nodes: ${nodes.length}`);
  
  // Find leaf nodes (nodes with no children)
  const nodeIds = new Set(nodes.map(n => n.id));
  const nodesWithChildren = new Set(nodes.filter(n => n.parentId).map(n => n.parentId!));
  
  const leafNodes = nodes.filter(n => !nodesWithChildren.has(n.id));
  console.log(`  Leaf nodes: ${leafNodes.length}`);
  
  // Assign line numbers to leaf nodes
  let lineNumber = 1;
  for (const node of leafNodes) {
    if (node.lineNumber !== lineNumber) {
      await prisma.practiceNode.update({
        where: { id: node.id },
        data: { lineNumber }
      });
      console.log(`  Assigned line ${lineNumber} to node ${node.id.substring(0, 8)}... (${node.move})`);
    }
    lineNumber++;
  }
  
  console.log(`  ✓ Fixed ${leafNodes.length} line numbers`);
}

async function main() {
  // Find all practices
  const practices = await prisma.practice.findMany({
    select: { id: true, name: true }
  });
  
  console.log(`Found ${practices.length} practices to check`);
  
  for (const practice of practices) {
    // Check current line count
    const lineCount = await prisma.practiceNode.count({
      where: {
        practiceId: practice.id,
        lineNumber: { not: null }
      }
    });
    
    if (lineCount <= 1) {
      console.log(`\n⚠️ ${practice.name}: Only ${lineCount} line(s) - needs fixing`);
      await fixPracticeLineNumbers(practice.id, practice.name);
    } else {
      console.log(`✓ ${practice.name}: ${lineCount} lines - OK`);
    }
  }
  
  console.log('\n========================================');
  console.log('Line number fix complete!');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
