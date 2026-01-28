import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const targetUsernames = ['katitooo', 'meliproto', 'ivantihov'];

        // Get users
        const users = await prisma.user.findMany({
            where: {
                lichessId: {
                    in: targetUsernames
                }
            },
            select: {
                id: true,
                lichessId: true,
                name: true
            }
        });

        console.log('Verifying leaderboard counts...\n');

        for (const user of users) {
            // Count 1: All successful attempts (like leaderboard)
            const allSuccessfulAttempts = await prisma.puzzleAttempt.count({
                where: {
                    userId: user.id,
                    success: true
                }
            });

            // Count 2: Unique puzzles solved
            const uniquePuzzles = await prisma.puzzleAttempt.groupBy({
                by: ['puzzleId'],
                where: {
                    userId: user.id,
                    success: true
                }
            });

            // Get total points (sum of points for successful attempts)
            const pointsAgg = await prisma.puzzleAttempt.aggregate({
                where: {
                    userId: user.id,
                    success: true
                },
                _sum: {
                    points: true
                }
            });

            console.log(`${user.lichessId} (${user.name}):`);
            console.log(`  Leaderboard "Number" (all successful attempts): ${allSuccessfulAttempts}`);
            console.log(`  Unique puzzles solved: ${uniquePuzzles.length}`);
            console.log(`  Total Points: ${pointsAgg._sum.points || 0}`);
            console.log();
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
