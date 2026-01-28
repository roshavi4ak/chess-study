import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const targetUsernames = ['katitooo', 'meliproto', 'ivantihov'];

        for (const username of targetUsernames) {
            const user = await prisma.user.findFirst({
                where: { lichessId: username },
                select: { id: true, name: true, ratingPuzzle: true }
            });

            if (!user) continue;

            console.log(`\n${'='.repeat(60)}`);
            console.log(`${user.name} (@${username}) - Rating: ${user.ratingPuzzle || 'N/A'}`);
            console.log('='.repeat(60));

            // Get all puzzle attempts
            const attempts = await prisma.puzzleAttempt.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'asc' }
            });

            // Group by puzzle
            const puzzleAttempts: Record<string, typeof attempts> = {};
            attempts.forEach(attempt => {
                if (!puzzleAttempts[attempt.puzzleId]) {
                    puzzleAttempts[attempt.puzzleId] = [];
                }
                puzzleAttempts[attempt.puzzleId].push(attempt);
            });

            // Calculate stats
            const puzzlesWithMultipleAttempts = Object.entries(puzzleAttempts).filter(
                ([_, attempts]) => attempts.length > 1
            );

            // First attempt solves (with points > 0 means first attempt was successful)
            const firstAttemptSolves = attempts.filter(a => a.points > 0).length;
            
            // Retry solves (successful but 0 points)
            const retrySolves = attempts.filter(a => a.success && a.points === 0).length;
            
            // Failed attempts
            const failedAttempts = attempts.filter(a => !a.success).length;

            // Total unique puzzles solved (at least one successful attempt)
            const uniquePuzzlesSolved = Object.values(puzzleAttempts).filter(
                attempts => attempts.some(a => a.success)
            ).length;

            // Points from first-attempt solves only
            const pointsFromFirstAttempt = attempts
                .filter(a => a.points > 0)
                .reduce((sum, a) => sum + a.points, 0);

            console.log(`Total Attempts: ${attempts.length}`);
            console.log(`Puzzles with Multiple Attempts: ${puzzlesWithMultipleAttempts.length}`);
            console.log(`\nSolve Breakdown:`);
            console.log(`  - First-attempt solves (earned points): ${firstAttemptSolves}`);
            console.log(`  - Retry solves (0 points): ${retrySolves}`);
            console.log(`  - Failed attempts: ${failedAttempts}`);
            console.log(`  - Total Successful: ${firstAttemptSolves + retrySolves}`);
            console.log(`\nUnique Puzzles Solved: ${uniquePuzzlesSolved}`);
            console.log(`Total Points Earned: ${pointsFromFirstAttempt}`);
            
            // Calculate retry rate among successful solves
            const totalSuccessful = firstAttemptSolves + retrySolves;
            const retryRate = totalSuccessful > 0 ? ((retrySolves / totalSuccessful) * 100).toFixed(1) : '0';
            console.log(`\nRetry Rate (among successful solves): ${retryRate}%`);
            
            // Average points per first-attempt solve
            const avgPointsFirstAttempt = firstAttemptSolves > 0 
                ? (pointsFromFirstAttempt / firstAttemptSolves).toFixed(2) 
                : '0';
            console.log(`Avg Points per First-Attempt Solve: ${avgPointsFirstAttempt}`);

            // Show puzzles with multiple attempts
            console.log(`\nPuzzles requiring retries: ${puzzlesWithMultipleAttempts.length} puzzles`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
