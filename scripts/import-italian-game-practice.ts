
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface PracticeNodeInput {
    id: string;
    fen: string;
    move: string | null;
    notes: string;
    lineNumber: number | null;
    children: PracticeNodeInput[];
}

async function getDevUser(): Promise<string> {
    const username = 'roshavi4ak'
    console.log(`Checking for user: ${username}...`)

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
                image: 'https://lichess1.org/assets/logo/lichess-pad3.svg'
            }
        })
        console.log('User created:', user)
    } else {
        console.log('User found:', user.id)
        if (user.role !== 'COACH') {
            console.log('Updating role to COACH...')
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'COACH' }
            })
            console.log('Role updated.')
        }
    }

    return user.id
}

async function importPracticeTree(userId: string) {
    const filePath = path.join(process.cwd(), 'openings', 'italian-game-opening-practice.json')
    console.log(`Reading practice tree from: ${filePath}`)

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
    }

    const fileContent = fs.readFileSync(filePath, 'utf8')
    const tree: PracticeNodeInput = JSON.parse(fileContent)

    console.log('Creating practice: Italian Game Opening')
    
    // Create the practice
    const practice = await prisma.practice.create({
        data: {
            name: 'Italian Game Opening',
            description: 'Learn the Italian Game - one of the oldest and most popular chess openings. This practice covers 22 different lines with detailed coaching notes in Bulgarian.',
            playerColor: 'WHITE',
            createdBy: userId,
        },
    })
    console.log(`Practice created: ${practice.id}`)

    // Recursively create nodes
    let nodeCount = 0
    async function createNodes(node: PracticeNodeInput, parentId: string | null, order: number) {
        const createdNode = await prisma.practiceNode.create({
            data: {
                practiceId: practice.id,
                parentId,
                fen: node.fen,
                move: node.move,
                notes: node.notes || null,
                order,
                lineNumber: node.lineNumber,
            },
        })
        nodeCount++
        if (nodeCount % 50 === 0) {
            console.log(`Created ${nodeCount} nodes...`)
        }

        // Create children
        for (let i = 0; i < node.children.length; i++) {
            await createNodes(node.children[i], createdNode.id, i)
        }
    }

    await createNodes(tree, null, 0)
    console.log(`Total nodes created: ${nodeCount}`)

    // Count leaf nodes (lines)
    const lineCount = await prisma.practiceNode.count({
        where: {
            practiceId: practice.id,
            lineNumber: { not: null },
        },
    })
    console.log(`Total lines (leaf nodes): ${lineCount}`)

    return practice
}

async function main() {
    try {
        const userId = await getDevUser()
        const practice = await importPracticeTree(userId)
        console.log('\n========================================')
        console.log('Successfully imported Italian Game practice!')
        console.log(`Practice ID: ${practice.id}`)
        console.log('========================================')
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
