
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPractices() {
    const practices = await prisma.practice.findMany({
        where: { name: { contains: "Vienna" } }
    });
    practices.forEach(p => console.log(`Practice: ${p.name}, ID: ${p.id}`));
}

checkPractices()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
