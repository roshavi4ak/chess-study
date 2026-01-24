import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Find user grigor19
        const user = await prisma.user.findFirst({
            where: { lichessId: 'grigor19' }
        });
        
        if (!user) {
            console.log('User grigor19 not found');
            return;
        }
        
        console.log('User:', user.name, 'ID:', user.id);
        
        // Find puzzle 01iMq
        const puzzle = await prisma.puzzle.findFirst({
            where: { name: '01iMq' }
        });
        
        if (!puzzle) {
            console.log('Puzzle 01iMq not found');
            return;
        }
        
        console.log('Puzzle:', puzzle.name, 'ID:', puzzle.id);
        
        // Get the attempt details
        const attempt = await prisma.puzzleAttempt.findFirst({
            where: {
                userId: user.id,
                puzzleId: puzzle.id,
                success: true
            }
        });
        
        if (!attempt) {
            console.log('No successful attempt found for puzzle 01iMq');
            return;
        }
        
        console.log('Solve time:', attempt.createdAt);
        console.log('Points earned:', attempt.points);
        
        // Get the user's rating information at the time of solving (if available)
        // We can't directly get historical ratings, but we can get current ratings
        console.log('\nCurrent user puzzle rating:', user.ratingPuzzle);
        console.log('Current user puzzle RD:', user.puzzleRd);
        console.log('Current user puzzle volatility:', user.puzzleVolatility);
        
        console.log('\nCurrent puzzle rating:', puzzle.rating);
        console.log('Current puzzle RD:', puzzle.ratingDeviation);
        console.log('Current puzzle volatility:', puzzle.volatility);
        
        // Calculate approximate Glicko-2 rating change to understand why 87 points
        console.log('\n\n=== Explanation ===');
        console.log('Points are calculated using the Glicko-2 rating system:');
        console.log('1. When solving a puzzle, the user and puzzle ratings are compared');
        console.log('2. The expected outcome is calculated based on ratings and RD (rating deviation)');
        console.log('3. The actual outcome (success) is used to update both ratings');
        console.log('4. The raw rating change from Glicko-2 is multiplied by 0.7 to get points');
        console.log('5. For puzzle 01iMq, the raw user rating change was approximately', Math.round(87 / 0.7), 'points');
        console.log('6. This large change suggests the user was much lower rated than the puzzle');
        
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();