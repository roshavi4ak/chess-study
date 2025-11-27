
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const userCount = await prisma.user.count();
        console.log(`User count: ${userCount}`);
        if (userCount > 0) {
            const firstUser = await prisma.user.findFirst();
            console.log('First user:', firstUser);
        } else {
            console.log('No users found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
