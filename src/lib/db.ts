import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error('[DB] ERROR: DATABASE_URL environment variable is not set')
    throw new Error('DATABASE_URL environment variable is required')
}

// Log initialization (only once)
if (!globalForPrisma.prisma) {
    console.log('[DB] Initializing Prisma Client...', {
        hasUrl: !!process.env.DATABASE_URL,
        urlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
        nodeEnv: process.env.NODE_ENV
    })
}

// Create Prisma client with optimized settings for shared hosting
export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    },
    errorFormat: 'pretty'
})

// Always cache in global to prevent multiple instances
if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = prisma
    console.log('[DB] Prisma Client cached in global')
}

// NOTE: Removed eager $connect() call - Prisma handles connection lazily
// This reduces initial process/thread spawning
