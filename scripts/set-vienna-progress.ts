import { PrismaClient, LineStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Vienna Gambit practice
  const practice = await prisma.practice.findFirst({
    where: { name: { contains: 'Vienna', mode: 'insensitive' } },
    include: { nodes: { where: { lineNumber: { not: null } }, orderBy: { lineNumber: 'asc' } } }
  });

  if (!practice) {
    console.error('Vienna Gambit practice not found!');
    return;
  }

  console.log(`Practice: ${practice.name}`);
  console.log(`Nodes with lineNumbers: ${practice.nodes.length}`);
  console.log(`Line numbers: ${practice.nodes.map(n => n.lineNumber).join(', ')}\n`);

  // Find users
  const users = await prisma.user.findMany({
    where: { name: { in: ['ivantihov', 'meliproto', 'grigor19'] } }
  });

  console.log(`Found users: ${users.map(u => u.name).join(', ')}`);

  if (users.length !== 3) {
    console.error('Not all users found!');
    return;
  }

  // Create progress entries for each user
  const progressData = [
    { user: users.find(u => u.name === 'ivantihov')!, perfectLines: 14, seenLines: 14 },
    { user: users.find(u => u.name === 'meliproto')!, perfectLines: 8, seenLines: 14 },
    { user: users.find(u => u.name === 'grigor19')!, perfectLines: 1, seenLines: 6 },
  ];

  for (const data of progressData) {
    console.log(`\n=== ${data.user.name} ===`);
    console.log(`  Perfect lines: 1-${data.perfectLines}`);
    console.log(`  Seen lines: 1-${data.seenLines}`);

    // Delete existing progress for this user and practice
    await prisma.practiceLineProgress.deleteMany({
      where: { userId: data.user.id, practiceId: practice.id }
    });

    // Create progress entries
    const progressEntries = [];

    // Mark seen lines (COMPLETED status)
    for (let line = 1; line <= data.seenLines; line++) {
      const node = practice.nodes.find(n => n.lineNumber === line);
      if (node) {
        progressEntries.push({
          userId: data.user.id,
          practiceId: practice.id,
          nodeId: node.id,
          status: line <= data.perfectLines ? LineStatus.PERFECT : LineStatus.COMPLETED,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // Mark additional seen lines (COMPLETED, not perfect)
    for (let line = data.perfectLines + 1; line <= data.seenLines; line++) {
      const node = practice.nodes.find(n => n.lineNumber === line);
      if (node) {
        // Check if already added
        if (!progressEntries.find(p => p.nodeId === node.id)) {
          progressEntries.push({
            userId: data.user.id,
            practiceId: practice.id,
            nodeId: node.id,
            status: LineStatus.COMPLETED,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }

    await prisma.practiceLineProgress.createMany({ data: progressEntries });
    console.log(`  Created ${progressEntries.length} progress entries`);
  }

  console.log('\n✅ Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
