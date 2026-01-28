import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Define target usernames (lowercase for consistency)
        const targetUsernames = ['katitooo', 'meliproto', 'ivantihov'];

        // Find all users matching target usernames
        const users = await prisma.user.findMany({
            where: {
                lichessId: {
                    in: targetUsernames
                }
            },
            select: {
                id: true,
                lichessId: true,
                name: true,
                ratingPuzzle: true
            }
        });

        console.log('Users found:');
        users.forEach(u => {
            console.log(`- LichessID: ${u.lichessId}, Name: ${u.name}, Rating: ${u.ratingPuzzle || 'N/A'}`);
        });
        console.log('\n');

        // Get all puzzle attempts for these users
        const userIds = users.map(u => u.id);
        const attempts = await prisma.puzzleAttempt.findMany({
            where: {
                userId: {
                    in: userIds
                }
            },
            include: {
                puzzle: true,
                user: {
                    select: {
                        lichessId: true,
                        name: true
                    }
                }
            }
        });

        // Group by user and puzzle (first attempt gets points, retries get 0)
        const userStats: Record<string, { totalPoints: number; solvedPuzzles: number; totalAttempts: number; uniquePuzzles: number; retries: number }> = {};
        
        attempts.forEach(attempt => {
            const userId = attempt.user.lichessId;
            const puzzleId = attempt.puzzleId;
            const points = attempt.points;
            
            if (!userId) return;
            
            if (!userStats[userId]) {
                userStats[userId] = { totalPoints: 0, solvedPuzzles: 0, totalAttempts: 0, uniquePuzzles: 0, retries: 0 };
            }
            
            userStats[userId].totalAttempts += 1;
        });

        // Now calculate per-puzzle stats (only count first attempt for points)
        const userPuzzleData: Record<string, Record<string, { points: number; attempts: number; solved: boolean }>> = {};
        
        attempts.forEach(attempt => {
            const userId = attempt.user.lichessId;
            const puzzleId = attempt.puzzleId;
            
            if (!userId) return;
            
            if (!userPuzzleData[userId]) {
                userPuzzleData[userId] = {};
            }
            
            if (!userPuzzleData[userId][puzzleId]) {
                userPuzzleData[userId][puzzleId] = { points: 0, attempts: 0, solved: false };
            }
            
            userPuzzleData[userId][puzzleId].points += attempt.points;
            userPuzzleData[userId][puzzleId].attempts += 1;
            if (attempt.success) {
                userPuzzleData[userId][puzzleId].solved = true;
            }
        });

        // Calculate statistics for each user
        console.log('='.repeat(60));
        console.log('DETAILED POINT ANALYSIS');
        console.log('='.repeat(60));

        targetUsernames.forEach(username => {
            const puzzleData = userPuzzleData[username];
            const user = users.find(u => u.lichessId === username);
            
            console.log(`\n=== ${username} (${user?.name}) ===`);
            console.log(`Current Puzzle Rating: ${user?.ratingPuzzle || 'N/A'}`);
            
            if (!puzzleData) {
                console.log('No puzzle attempts found');
                return;
            }
            
            const solvedEntries = Object.entries(puzzleData).filter(([_, stats]) => stats.solved);
            const unsolvedEntries = Object.entries(puzzleData).filter(([_, stats]) => !stats.solved);
            
            // Calculate total points from solved puzzles
            const totalPoints = solvedEntries.reduce((sum, [_, stats]) => sum + stats.points, 0);
            const totalSolved = solvedEntries.length;
            const averagePointsPerSolved = totalSolved > 0 ? (totalPoints / totalSolved).toFixed(2) : '0';
            
            // Count retries (attempts > 1)
            const retryCount = Object.values(puzzleData).filter(stats => stats.attempts > 1).length;
            
            // Total unique puzzles attempted
            const uniquePuzzles = Object.keys(puzzleData).length;
            
            // Calculate percentage of puzzles solved on first try
            const firstTrySolved = solvedEntries.filter(([_, stats]) => stats.attempts === 1).length;
            const firstTryPercentage = totalSolved > 0 ? ((firstTrySolved / totalSolved) * 100).toFixed(1) : '0';
            
            console.log(`\nSummary:`);
            console.log(`  Total Unique Puzzles Attempted: ${uniquePuzzles}`);
            console.log(`  Puzzles Solved: ${totalSolved}`);
            console.log(`  Puzzles Unsolved: ${unsolvedEntries.length}`);
            console.log(`  Puzzles with Retries: ${retryCount}`);
            console.log(`  First-Try Success Rate: ${firstTryPercentage}%`);
            console.log(`\nPoints:`);
            console.log(`  Total Points Earned: ${totalPoints}`);
            console.log(`  Average Points per Solved Puzzle: ${averagePointsPerSolved}`);
            
            // Show top 5 and bottom 5 solved puzzles by points
            console.log(`\nTop 5 Solved Puzzles (by points):`);
            solvedEntries
                .sort((a, b) => b[1].points - a[1].points)
                .slice(0, 5)
                .forEach(([puzzleId, stats]) => {
                    const puzzle = attempts.find(a => a.puzzleId === puzzleId)?.puzzle;
                    console.log(`  - ${puzzle?.name || puzzleId}: ${stats.points} pts (${stats.attempts} attempt${stats.attempts > 1 ? 's' : ''})`);
                });
            
            console.log(`\nBottom 5 Solved Puzzles (by points):`);
            solvedEntries
                .sort((a, b) => a[1].points - b[1].points)
                .slice(0, 5)
                .forEach(([puzzleId, stats]) => {
                    const puzzle = attempts.find(a => a.puzzleId === puzzleId)?.puzzle;
                    console.log(`  - ${puzzle?.name || puzzleId}: ${stats.points} pts (${stats.attempts} attempt${stats.attempts > 1 ? 's' : ''})`);
                });
            
            console.log('='.repeat(60));
        });

        // Final comparison table
        console.log('\n\nFINAL COMPARISON TABLE');
        console.log('='.repeat(60));
        console.log('Username       | Rating  | Solved   | Avg Pts   | First Try %');
        console.log('-'.repeat(60));

        targetUsernames.forEach(username => {
            const puzzleData = userPuzzleData[username];
            const user = users.find(u => u.lichessId === username);
            
            if (!puzzleData) return;
            
            const solvedEntries = Object.entries(puzzleData).filter(([_, stats]) => stats.solved);
            const totalPoints = solvedEntries.reduce((sum, [_, stats]) => sum + stats.points, 0);
            const totalSolved = solvedEntries.length;
            const averagePoints = totalSolved > 0 ? (totalPoints / totalSolved).toFixed(2) : '0';
            
            const firstTrySolved = solvedEntries.filter(([_, stats]) => stats.attempts === 1).length;
            const firstTryPercentage = totalSolved > 0 ? ((firstTrySolved / totalSolved) * 100).toFixed(1) : '0';
            
            const ratingStr = (user?.ratingPuzzle || 'N/A').toString();
            console.log(
                username.padEnd(15) + ' | ' +
                ratingStr.padEnd(8) + ' | ' +
                totalSolved.toString().padEnd(8) + ' | ' +
                averagePoints.padEnd(10) + ' | ' +
                firstTryPercentage + '%'
            );
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
