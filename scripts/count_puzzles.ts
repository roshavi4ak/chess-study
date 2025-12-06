
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const range1 = await prisma.puzzle.count({
        where: {
            rating: {
                gte: 1700,
                lt: 2000
            }
        }
    });

    const range2 = await prisma.puzzle.count({
        where: {
            rating: {
                gte: 2000,
                lt: 2400
            }
        }
    });

    const rangeLow = await prisma.puzzle.count({
        where: {
            rating: {
                lt: 1700
            }
        }
    });

    console.log(`Puzzles < 1700: ${rangeLow}`);
    console.log(`Puzzles 1700-2000: ${range1}`);
    console.log(`Puzzles 2000-2400: ${range2}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
