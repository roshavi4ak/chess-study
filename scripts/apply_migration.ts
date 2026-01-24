import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Checking if UserTagStats table exists...')
    
    // Check if the table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'UserTagStats'
      )
    `
    
    if (!(tableExists as Array<{ exists: boolean }>)[0].exists) {
      console.log('Creating UserTagStats table...')
      
      // Create the table
      await prisma.$executeRaw`
        CREATE TABLE "UserTagStats" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "tag" TEXT NOT NULL,
            "totalCount" INTEGER NOT NULL DEFAULT 0,
            "unsolvedCount" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "UserTagStats_pkey" PRIMARY KEY ("id")
        )
      `
      
      console.log('Creating indexes...')
      
      // Create indexes
      await prisma.$executeRaw`CREATE INDEX "UserTagStats_userId_idx" ON "UserTagStats"("userId")`
      await prisma.$executeRaw`CREATE UNIQUE INDEX "UserTagStats_userId_tag_key" ON "UserTagStats"("userId", "tag")`
      
      console.log('Creating foreign key constraint...')
      
      // Add foreign key constraint
      await prisma.$executeRaw`
        ALTER TABLE "UserTagStats" 
        ADD CONSTRAINT "UserTagStats_userId_fkey" 
        FOREIGN KEY ("userId") 
        REFERENCES "User"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `
      
      console.log('Migration applied successfully!')
    } else {
      console.log('UserTagStats table already exists')
    }
  } catch (error) {
    console.error('Error applying migration:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()