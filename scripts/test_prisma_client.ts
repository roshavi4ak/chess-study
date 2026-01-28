import { PrismaClient } from '@prisma/client'

async function main() {
  console.log('Testing Prisma Client...')
  
  const prisma = new PrismaClient({
    log: ['info', 'warn', 'error']
  })

  try {
    // Test connection to database
    console.log('Testing database connection...')
    await prisma.$connect()
    console.log('Connection successful')

    // Test that Prisma Client has UserTagStats model
    console.log('Checking Prisma Client models...')
    const models = Object.keys(prisma)
    console.log('Available models:', models)
    
    if (!models.includes('userTagStats')) {
      console.error('ERROR: UserTagStats model not available in Prisma Client')
      return
    }

    // Test that UserTagStats table exists in database
    console.log('Checking if UserTagStats table exists...')
    const tableInfo = await prisma.$queryRaw`
      SELECT * FROM information_schema.tables 
      WHERE table_name = 'UserTagStats' OR table_name = 'usertagstats'
    ` as any[]
    console.log('Table info:', tableInfo)
    
    if (tableInfo.length === 0) {
      console.error('ERROR: UserTagStats table does not exist in database')
      return
    }

    // Test that we can query the UserTagStats table
    console.log('Querying UserTagStats table...')
    const tagStats = await prisma.userTagStats.findMany({
      take: 5
    })
    console.log('Found tag stats entries:', tagStats)

    console.log('All tests passed!')

  } catch (error) {
    console.error('Error testing Prisma Client:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()