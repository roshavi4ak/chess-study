
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
    const users = await prisma.user.findMany({ where: { name: "roshavi4ak" } });
    console.log(`Found ${users.length} users with name 'roshavi4ak':`);
    users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}`));
}

checkUsers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
