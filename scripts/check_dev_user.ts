
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const username = 'roshavi4ak'
    console.log(`Checking for user: ${username}...`)

    // Try to find by name or lichessId 
    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { name: username },
                { lichessId: username }
            ]
        }
    })

    if (!user) {
        console.log(`User ${username} not found. Creating...`)
        user = await prisma.user.create({
            data: {
                name: username,
                email: `${username}@example.com`,
                role: 'COACH',
                lichessId: username,
                image: 'https://lichess1.org/assets/logo/lichess-pad3.svg' // Dummy image
            }
        })
        console.log('User created:', user)
    } else {
        console.log('User found:', user)
        if (user.role !== 'COACH') {
            console.log('Updating role to COACH...')
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'COACH' }
            })
            console.log('Role updated.')
        }
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
