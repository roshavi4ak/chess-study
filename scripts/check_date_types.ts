import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Check Puzzle table
        const puzzle = await prisma.puzzle.findFirst({
            select: {
                createdAt: true
            }
        });
        
        // Check PuzzleAttempt table
        const puzzleAttempt = await prisma.puzzleAttempt.findFirst({
            select: {
                createdAt: true
            }
        });
        
        // Check Practice table
        const practice = await prisma.practice.findFirst({
            select: {
                createdAt: true
            }
        });
        
        console.log('Date types:');
        if (puzzle) {
            console.log(`Puzzle.createdAt: ${puzzle.createdAt} (type: ${typeof puzzle.createdAt})`);
        }
        if (puzzleAttempt) {
            console.log(`PuzzleAttempt.createdAt: ${puzzleAttempt.createdAt} (type: ${typeof puzzleAttempt.createdAt})`);
        }
        if (practice) {
            console.log(`Practice.createdAt: ${practice.createdAt} (type: ${typeof practice.createdAt})`);
        }
        
    } catch (error) {
        console.error('Error checking date types:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();