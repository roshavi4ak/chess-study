import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'cmidi8gr50000v8vc36ubbgir'; // From logs

  const progress = await prisma.practiceLineProgress.findMany({
    where: { userId },
    include: { practice: { select: { name: true } } },
  });

  console.log('Current progress records:');
  progress.forEach(p => {
    console.log(`${p.practice.name}: ${p.status} on node ${p.nodeId}`);
  });

  console.log(`Total: ${progress.length} records`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });