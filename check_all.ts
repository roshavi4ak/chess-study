
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllPractices() {
    const username = "roshavi4ak";
    const user = await prisma.user.findFirst({ where: { name: username } });

    if (!user) {
        console.log("User not found");
        return;
    }

    const allPractices = await prisma.practice.findMany({
        where: { createdBy: user.id },
        include: { nodes: true }
    });

    for (const practice of allPractices) {
        const leafNodes = practice.nodes.filter(n => !practice.nodes.some(child => child.parentId === n.id));
        const progressCount = await prisma.practiceLineProgress.count({
            where: { userId: user.id, practiceId: practice.id }
        });
        console.log(`Practice: ${practice.name} (ID: ${practice.id}) - Total Leaf Nodes: ${leafNodes.length}, Progress Records: ${progressCount}`);
    }
}

checkAllPractices()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
