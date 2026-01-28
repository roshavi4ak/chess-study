import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    // Find user by lichessId 'roshavi4ak'
    const user = await prisma.user.findFirst({
      where: {
        lichessId: 'roshavi4ak'
      },
      select: {
        id: true,
        name: true,
        lichessId: true
      }
    })

    if (!user) {
      console.error("User not found")
      return
    }

    console.log("User found:", user)

    // Get all puzzle attempts for this user
    const puzzleAttempts = await prisma.puzzleAttempt.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        puzzle: {
          select: {
            name: true,
            tags: true
          }
        }
      },
      take: 10
    })

    console.log("\nLast 10 puzzle attempts:", puzzleAttempts)

    // Check if there are any tag stats for this user
    const tagStats = await prisma.userTagStats.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        totalCount: 'desc'
      }
    })

    console.log("\nTag stats for user:", tagStats)

  } catch (error) {
    console.error("Error checking user puzzle attempts:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()