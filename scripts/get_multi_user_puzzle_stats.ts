import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Define target usernames (lowercase for consistency)
        const targetUsernames = ['grigor19', 'katitooo', 'meliproto', 'kaloqnkostov', 'ivantihov'];

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
                name: true
            }
        });

        console.log('Users found:');
        users.forEach(u => {
            console.log(`- LichessID: ${u.lichessId}, Name: ${u.name}, ID: ${u.id}`);
        });

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

        // Group by user and puzzle
        const userStats: Record<string, Record<string, { points: number; attempts: number; solved: boolean }>> = {};
        
        attempts.forEach(attempt => {
            const userId = attempt.user.lichessId;
            const puzzleId = attempt.puzzleId;
            
            if (!userId) {
                return; // Skip if user has no lichessId
            }
            
            if (!userStats[userId]) {
                userStats[userId] = {};
            }
            
            if (!userStats[userId][puzzleId]) {
                userStats[userId][puzzleId] = {
                    points: 0,
                    attempts: 0,
                    solved: false
                };
            }
            
            userStats[userId][puzzleId].points += attempt.points;
            userStats[userId][puzzleId].attempts += 1;
            if (attempt.success) {
                userStats[userId][puzzleId].solved = true;
            }
        });

        // Display statistics for each user
        targetUsernames.forEach(username => {
            const userAttempts = userStats[username];
            
            console.log(`\n\n=== Statistics for ${username} ===`);
            
            if (!userAttempts) {
                console.log('No puzzle attempts found');
                return;
            }
            
            const solvedPuzzles = Object.entries(userAttempts).filter(([_, stats]) => stats.solved);
            const unsolvedPuzzles = Object.entries(userAttempts).filter(([_, stats]) => !stats.solved);
            
            console.log(`Total solved puzzles: ${solvedPuzzles.length}`);
            console.log(`Total unsolved puzzles: ${unsolvedPuzzles.length}`);
            
            console.log('\nSolved Puzzles:');
            solvedPuzzles.forEach(([puzzleId, stats]) => {
                const puzzle = attempts.find(a => a.puzzleId === puzzleId)?.puzzle;
                if (puzzle) {
                    console.log(`- Puzzle: ${puzzle.name}, Points: ${stats.points}, Attempts: ${stats.attempts}`);
                }
            });
            
            console.log('\nUnsolved Puzzles:');
            unsolvedPuzzles.forEach(([puzzleId, stats]) => {
                const puzzle = attempts.find(a => a.puzzleId === puzzleId)?.puzzle;
                if (puzzle) {
                    console.log(`- Puzzle: ${puzzle.name}, Points Lost: ${Math.abs(stats.points)}, Attempts: ${stats.attempts}`);
                }
            });
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();