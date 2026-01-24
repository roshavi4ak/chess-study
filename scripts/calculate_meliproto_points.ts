import { PrismaClient } from '@prisma/client';
import { Glicko2, RatingData, MatchResult } from '@/lib/glicko2';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('=== Calculating Points for Meliproto ===\n');

        // Step 1: Find user meliproto
        const user = await prisma.user.findFirst({
            where: { lichessId: 'meliproto' }
        });
        
        if (!user) {
            console.log('User meliproto not found');
            return;
        }
        
        console.log('User found:', user.name);
        console.log('Current puzzle rating:', user.ratingPuzzle);
        console.log('Current puzzle RD:', user.puzzleRd);
        console.log('Current puzzle volatility:', user.puzzleVolatility);
        console.log();

        // Step 2: Get all her puzzle attempts with 0 points (solved)
        const zeroPointAttempts = await prisma.puzzleAttempt.findMany({
            where: {
                userId: user.id,
                success: true,
                points: 0
            },
            include: {
                puzzle: true
            }
        });

        console.log(`Found ${zeroPointAttempts.length} puzzles with 0 points (solved)`);
        console.log();

        if (zeroPointAttempts.length === 0) {
            console.log('No zero-point puzzles found');
            return;
        }

        // Step 3: Calculate points as new user
        const newUserRating: RatingData = {
            rating: 1500,
            rd: 350,
            volatility: 0.06
        };

        console.log('=== Points Calculation ===');
        console.log('Using new user parameters:');
        console.log(`Rating: ${newUserRating.rating}`);
        console.log(`RD: ${newUserRating.rd}`);
        console.log(`Volatility: ${newUserRating.volatility}`);
        console.log();

        let totalPoints = 0;
        const results: Array<{
            puzzleName: string;
            puzzleRating: number;
            puzzleRd: number;
            rawChange: number;
            points: number;
        }> = [];

        for (const attempt of zeroPointAttempts) {
            const puzzleRating: RatingData = {
                rating: attempt.puzzle.rating,
                rd: attempt.puzzle.ratingDeviation,
                volatility: attempt.puzzle.volatility
            };

            // Calculate Glicko-2 rating change
            const result: MatchResult = {
                opponentRating: puzzleRating.rating,
                opponentRd: puzzleRating.rd,
                score: 1
            };

            const newRating = Glicko2.calculateNewRating(newUserRating, [result]);
            const rawChange = newRating.rating - newUserRating.rating;
            const points = Math.round(rawChange * 0.7);

            results.push({
                puzzleName: attempt.puzzle.name,
                puzzleRating: Math.round(puzzleRating.rating),
                puzzleRd: Math.round(puzzleRating.rd),
                rawChange: Math.round(rawChange),
                points: points
            });

            totalPoints += points;
        }

        // Step 4: Display results
        console.log('=== Results ===');
        results.forEach(res => {
            console.log(`Puzzle ${res.puzzleName}:`);
            console.log(`  Puzzle Rating: ${res.puzzleRating} (RD: ${res.puzzleRd})`);
            console.log(`  Raw Change: ${res.rawChange} points`);
            console.log(`  Points Earned: ${res.points}`);
            console.log();
        });

        console.log('=== Summary ===');
        console.log(`Total points to add: ${totalPoints}`);
        console.log(`Number of puzzles: ${results.length}`);
        console.log(`Average points per puzzle: ${Math.round(totalPoints / results.length)}`);
        console.log();

        // Step 5: Show what her new total would be
        const currentPointsResult = await prisma.puzzleAttempt.groupBy({
            by: ['userId'],
            where: {
                userId: user.id,
                success: true
            },
            _sum: {
                points: true
            }
        });

        const currentPoints = currentPointsResult[0]?._sum.points || 0;
        const newTotalPoints = currentPoints + totalPoints;

        console.log('=== Current vs. New Total ===');
        console.log(`Current total points: ${currentPoints}`);
        console.log(`New total points: ${newTotalPoints}`);
        console.log();

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();