import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find practices by name
  const vienna = await prisma.practice.findFirst({
    where: { name: { contains: 'Vienna' } },
  });
  const stafford = await prisma.practice.findFirst({
    where: { name: { contains: 'Stafford' } },
  });

  console.log('Vienna:', vienna?.id, vienna?.name);
  console.log('Stafford:', stafford?.id, stafford?.name);

  const practiceIds = [vienna?.id, stafford?.id].filter(Boolean) as string[];

  for (const practiceId of practiceIds) {
    console.log(`Deleting progress for practice ${practiceId}`);

    const deleted = await prisma.practiceLineProgress.deleteMany({
      where: {
        practiceId,
      },
    });

    console.log(`Deleted ${deleted.count} progress records for ${practiceId}`);

    await prisma.practiceAttempt.deleteMany({
      where: {
        practiceId,
      },
    });

    console.log('Deleted practice attempts');
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