import { PrismaClient } from '@prisma/client';
import { Glicko2, RatingData, MatchResult } from '@/lib/glicko2';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('=== Updating Points for Meliproto ===\n');

        // Step 1: Find user meliproto
        const user = await prisma.user.findFirst({
            where: { lichessId: 'meliproto' }
        });
        
        if (!user) {
            console.log('User meliproto not found');
            return;
        }
        
        console.log('User found:', user.name);
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

        // Step 3: Calculate and update points
        const newUserRating: RatingData = {
            rating: 1500,
            rd: 350,
            volatility: 0.06
        };

        console.log('=== Updating Points ===');
        
        const updates = [];
        
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

            // Update the attempt
            const update = prisma.puzzleAttempt.update({
                where: { id: attempt.id },
                data: { points: points }
            });
            
            updates.push(update);

            console.log(`Puzzle ${attempt.puzzle.name}: ${points} points`);
        }

        // Execute all updates in a transaction
        await prisma.$transaction(updates);
        console.log();
        console.log('✅ All points updated successfully!');
        console.log();

        // Step 4: Verify the changes
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

        console.log('=== Final Total Points ===');
        console.log(`Meliproto's total points: ${currentPoints}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();