import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error('[DB] ERROR: DATABASE_URL environment variable is not set')
    throw new Error('DATABASE_URL environment variable is required')
}

console.log('[DB] Initializing Prisma Client...', {
    hasUrl: !!process.env.DATABASE_URL,
    urlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
    nodeEnv: process.env.NODE_ENV
})

export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    },
    errorFormat: 'pretty'
})

// Always cache in global to prevent multiple instances in production
if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = prisma
    console.log('[DB] Prisma Client cached in global')
}

// Test connection on initialization
prisma.$connect()
    .then(() => console.log('[DB] Successfully connected to database'))
    .catch((error) => console.error('[DB] Failed to connect to database:', error.message))
