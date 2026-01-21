import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Find the user
        const user = await prisma.user.findFirst({
            where: { lichessId: 'grigor19' }
        });
        if (!user) {
            console.log('User not found');
            return;
        }
        console.log('User:', user.name, 'ID:', user.id);

        // Get all puzzle attempts
        const attempts = await prisma.puzzleAttempt.findMany({
            where: {
                userId: user.id
            },
            include: {
                puzzle: true
            }
        });

        console.log('Total attempts:', attempts.length);

        // Group by puzzle and sum points
        const puzzleStats = attempts.reduce((acc, attempt) => {
            const puzzleId = attempt.puzzleId;
            if (!acc[puzzleId]) {
                acc[puzzleId] = {
                    name: attempt.puzzle.name,
                    totalPoints: 0,
                    attempts: 0,
                    solved: false
                };
            }
            acc[puzzleId].totalPoints += attempt.points;
            acc[puzzleId].attempts += 1;
            if (attempt.success) {
                acc[puzzleId].solved = true;
            }
            return acc;
        }, {} as Record<string, { name: string; totalPoints: number; attempts: number; solved: boolean }>);

        const solvedStats = Object.values(puzzleStats).filter(stat => stat.solved);
        const unsolvedStats = Object.values(puzzleStats).filter(stat => !stat.solved);

        console.log('Solved Puzzles:');
        solvedStats.forEach(stat => {
            console.log(`Puzzle: ${stat.name}, Points: ${stat.totalPoints}, Attempts: ${stat.attempts}`);
        });

        console.log('Unsolved Puzzles:');
        unsolvedStats.forEach(stat => {
            console.log(`Puzzle: ${stat.name}, Points Lost: ${Math.abs(stat.totalPoints)}, Attempts: ${stat.attempts}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();