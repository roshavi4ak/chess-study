import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Get katitooo's user ID
        const user = await prisma.user.findFirst({
            where: { lichessId: 'katitooo' },
            select: { id: true, name: true }
        });

        if (!user) {
            console.log('User not found');
            return;
        }

        console.log(`Checking retries for ${user.name} (${user.id})`);
        console.log('='.repeat(60));

        // Get all puzzle attempts for katitooo
        const attempts = await prisma.puzzleAttempt.findMany({
            where: { userId: user.id },
            include: { puzzle: true },
            orderBy: { createdAt: 'asc' }
        });

        console.log(`Total attempts: ${attempts.length}`);

        // Group by puzzle
        const puzzleAttempts: Record<string, typeof attempts> = {};
        attempts.forEach(attempt => {
            if (!puzzleAttempts[attempt.puzzleId]) {
                puzzleAttempts[attempt.puzzleId] = [];
            }
            puzzleAttempts[attempt.puzzleId].push(attempt);
        });

        // Count puzzles with multiple attempts
        const puzzlesWithMultipleAttempts = Object.entries(puzzleAttempts).filter(
            ([_, attempts]) => attempts.length > 1
        );

        console.log(`Puzzles with multiple attempts: ${puzzlesWithMultipleAttempts.length}`);

        // For puzzles with multiple attempts, show details
        console.log('\nDetails of puzzles with multiple attempts:');
        puzzlesWithMultipleAttempts.forEach(([puzzleId, attempts]) => {
            const puzzle = attempts[0].puzzle;
            const solvedOnFirstTry = attempts[0].success;
            const totalAttempts = attempts.length;
            const firstAttemptPoints = attempts[0].points;
            const totalPoints = attempts.reduce((sum, a) => sum + a.points, 0);
            
            console.log(`\n- Puzzle: ${puzzle.name} (${puzzleId})`);
            console.log(`  Attempts: ${totalAttempts}`);
            console.log(`  First attempt solved: ${solvedOnFirstTry}`);
            console.log(`  Points from first attempt: ${firstAttemptPoints}`);
            console.log(`  Total points: ${totalPoints}`);
        });

        // Calculate statistics
        const successfulFirstAttempts = attempts.filter(a => a.success && a.points > 0).length;
        const successfulRetries = attempts.filter(a => a.success && a.points === 0).length;
        const failedAttempts = attempts.filter(a => !a.success).length;

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY:');
        console.log(`  Total successful attempts: ${attempts.filter(a => a.success).length}`);
        console.log(`  - First-attempt solves (with points): ${successfulFirstAttempts}`);
        console.log(`  - Retry solves (0 points): ${successfulRetries}`);
        console.log(`  Failed attempts: ${failedAttempts}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
