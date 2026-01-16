
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listAllProgress() {
    const username = "roshavi4ak";
    const user = await prisma.user.findFirst({ where: { name: username } });

    if (!user) {
        console.log("User not found");
        return;
    }

    const progressByPractice = await prisma.practiceLineProgress.groupBy({
        by: ['practiceId'],
        where: { userId: user.id },
        _count: { _all: true }
    });

    for (const p of progressByPractice) {
        const practice = await prisma.practice.findUnique({ where: { id: p.practiceId } });
        console.log(`Practice Name: ${practice?.name} (ID: ${p.practiceId}) - Progress Count: ${p._count._all}`);
    }
}

listAllProgress()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
