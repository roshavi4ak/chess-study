import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Fetching user tag statistics...')
    
    // Get all users with their tag stats
    const users = await prisma.user.findMany({
      where: {
        tagStats: {
          some: {}
        }
      },
      select: {
        id: true,
        name: true,
        lichessId: true,
        tagStats: {
          select: {
            tag: true,
            totalCount: true,
            unsolvedCount: true
          },
          orderBy: {
            totalCount: 'desc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })
    
    console.log(`Found ${users.length} users with tag statistics`)
    console.log('')
    
    // Display tag stats for each user
    for (const user of users) {
      console.log(`User: ${user.name || 'Anonymous'} (${user.lichessId || 'No Lichess ID'})`)
      console.log('-' . repeat(50))
      
      if (user.tagStats.length === 0) {
        console.log('  No tag statistics found')
      } else {
        // Calculate total tags and unsolved tags
        const totalUniqueTags = user.tagStats.length
        const totalEncounters = user.tagStats.reduce((sum, stat) => sum + stat.totalCount, 0)
        const totalUnsolved = user.tagStats.reduce((sum, stat) => sum + stat.unsolvedCount, 0)
        
        console.log(`  Total unique tags: ${totalUniqueTags}`)
        console.log(`  Total tag encounters: ${totalEncounters}`)
        console.log(`  Total unsolved tag encounters: ${totalUnsolved}`)
        console.log('')
        
        console.log('  Tag breakdown:')
        for (const tagStat of user.tagStats) {
          const solvedCount = tagStat.totalCount - tagStat.unsolvedCount
          const solveRate = tagStat.totalCount > 0 ? (solvedCount / tagStat.totalCount * 100).toFixed(1) : '0.0'
          
          console.log(`    ${tagStat.tag.padEnd(20)}: ${tagStat.totalCount.toString().padStart(4)} total, ${solvedCount.toString().padStart(4)} solved (${solveRate}%), ${tagStat.unsolvedCount.toString().padStart(4)} unsolved`)
        }
      }
      
      console.log('')
      console.log('=' . repeat(50))
      console.log('')
    }
    
  } catch (error) {
    console.error('Error fetching user tag statistics:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()