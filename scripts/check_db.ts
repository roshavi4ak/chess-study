
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const puzzleCount = await prisma.puzzle.count();
        console.log(`Total Puzzles: ${puzzleCount}`);

        const sample = await prisma.puzzle.findFirst({
            where: { rating: { lt: 1700 } }
        });
        console.log('Sample imported puzzle:', sample);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
