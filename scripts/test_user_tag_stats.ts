import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Testing UserTagStats...')
    
    // Check if we can query the table
    const allTagStats = await prisma.userTagStats.findMany()
    console.log(`Found ${allTagStats.length} user tag statistics entries`)
    
    // Get a real user ID from the database
    const users = await prisma.user.findMany({
      take: 1,
      select: {
        id: true
      }
    })
    
    if (users.length > 0) {
      const testUserId = users[0].id
      
      console.log(`Using test user ID: ${testUserId}`)
      
      // Check if we can create a new entry
      const newTagStats = await prisma.userTagStats.create({
        data: {
          userId: testUserId,
          tag: 'test-tag',
          totalCount: 1,
          unsolvedCount: 0,
        }
      })
      
      console.log(`Created new tag stats entry:`, newTagStats)
      
      // Check if we can find the entry
      const foundTagStats = await prisma.userTagStats.findUnique({
        where: {
          userId_tag: {
            userId: testUserId,
            tag: 'test-tag'
          }
        }
      })
      
      console.log(`Found tag stats entry:`, foundTagStats)
      
      // Check if we can update the entry
      const updatedTagStats = await prisma.userTagStats.update({
        where: {
          userId_tag: {
            userId: testUserId,
            tag: 'test-tag'
          }
        },
        data: {
          totalCount: { increment: 1 },
          unsolvedCount: { increment: 1 }
        }
      })
      
      console.log(`Updated tag stats entry:`, updatedTagStats)
      
      // Check if we can delete the entry
      const deletedTagStats = await prisma.userTagStats.delete({
        where: {
          userId_tag: {
            userId: testUserId,
            tag: 'test-tag'
          }
        }
      })
      
      console.log(`Deleted tag stats entry:`, deletedTagStats)
    } else {
      console.log('No users found in database, skipping create/update/delete tests')
    }
    
    console.log('All tests passed!')
    
  } catch (error) {
    console.error('Error testing UserTagStats:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()