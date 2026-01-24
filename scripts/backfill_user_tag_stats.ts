import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Starting backfill of UserTagStats table...')
    
    // Get all PuzzleAttempts with associated Puzzle and User
    console.log('Fetching all PuzzleAttempts...')
    const puzzleAttempts = await prisma.puzzleAttempt.findMany({
      include: {
        puzzle: {
          select: {
            tags: true
          }
        },
        user: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })
    
    console.log(`Found ${puzzleAttempts.length} PuzzleAttempts`)
    
    // Process each attempt
    let processed = 0
    const updates = []
    
    console.log('Processing PuzzleAttempts...')
    for (const attempt of puzzleAttempts) {
      // Skip if puzzle has no tags
      if (!attempt.puzzle.tags || attempt.puzzle.tags.length === 0) {
        processed++
        continue
      }
      
      // For each tag in the puzzle
      for (const tag of attempt.puzzle.tags) {
        // Upsert the tag stats for this user and tag
        updates.push(
          prisma.userTagStats.upsert({
            where: {
              userId_tag: {
                userId: attempt.user.id,
                tag: tag
              }
            },
            update: {
              totalCount: { increment: 1 },
              unsolvedCount: { increment: attempt.success ? 0 : 1 }
            },
            create: {
              userId: attempt.user.id,
              tag: tag,
              totalCount: 1,
              unsolvedCount: attempt.success ? 0 : 1
            }
          })
        )
      }
      
      processed++
      
      // Log progress every 100 attempts
      if (processed % 100 === 0) {
        console.log(`Processed ${processed} of ${puzzleAttempts.length} attempts`)
      }
    }
    
    // Execute all updates in batches to avoid performance issues
    const batchSize = 100
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      await prisma.$transaction(batch)
      console.log(`Batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(updates.length / batchSize)} completed`)
    }
    
    // Verify the backfill
    const totalTagStats = await prisma.userTagStats.count()
    console.log(`Backfill complete! Total tag stats entries: ${totalTagStats}`)
    
    // Get some summary statistics
    const tagCountSummary = await prisma.userTagStats.groupBy({
      by: ['tag'],
      _count: true,
      _sum: {
        totalCount: true,
        unsolvedCount: true
      },
      orderBy: {
        _count: {
          tag: 'desc'
        }
      },
      take: 10
    })
    
    console.log('\nTop 10 most common tags:')
    tagCountSummary.forEach((summary) => {
      console.log(`${summary.tag}: ${summary._sum.totalCount} total (${summary._sum.unsolvedCount} unsolved)`);
    })
    
  } catch (error) {
    console.error('Error during backfill:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()