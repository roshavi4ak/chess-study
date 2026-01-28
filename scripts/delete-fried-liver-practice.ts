import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Fried Liver Attack practice
  const friedLiverPractice = await prisma.practice.findFirst({
    where: { name: { contains: 'Fried Liver' } },
  });

  if (!friedLiverPractice) {
    console.log('Fried Liver Attack practice not found');
    return;
  }

  console.log('Found practice:', friedLiverPractice.id, friedLiverPractice.name);

  // Delete all related practice progress records
  const deletedProgress = await prisma.practiceLineProgress.deleteMany({
    where: { practiceId: friedLiverPractice.id },
  });
  console.log(`Deleted ${deletedProgress.count} practice progress records`);

  // Delete all related practice attempt records
  const deletedAttempts = await prisma.practiceAttempt.deleteMany({
    where: { practiceId: friedLiverPractice.id },
  });
  console.log(`Deleted ${deletedAttempts.count} practice attempt records`);

  // Delete all practice nodes
  const deletedNodes = await prisma.practiceNode.deleteMany({
    where: { practiceId: friedLiverPractice.id },
  });
  console.log(`Deleted ${deletedNodes.count} practice nodes`);

  // Delete the practice itself
  await prisma.practice.delete({
    where: { id: friedLiverPractice.id },
  });
  console.log('Successfully deleted Fried Liver Attack practice');
}

main()
  .catch((e) => {
    console.error('Error deleting Fried Liver Attack practice:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
