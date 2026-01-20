
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsernames() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            lichessId: true,
            name: true,
        }
    });

    console.log("Current users in database:");
    users.forEach(u => {
        console.log(`- Username: ${u.lichessId || "N/A"} (Name: ${u.name || "None"})`);
    });
}

listUsernames()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
