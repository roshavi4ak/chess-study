
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findFirst({
        where: { name: 'roshavi4ak' },
        select: { name: true, ratingPuzzle: true, puzzleRd: true, puzzleVolatility: true }
    })
    console.log('User found:', user)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
