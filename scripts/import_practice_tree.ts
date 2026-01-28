import { PrismaClient, PlayerColor } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Configuration
const USER_ID = 'cmidi8gr50000v8vc36ubbgir'; // roshavi4ak (same as import_puzzles.ts)
const PRACTICE_NAME = 'Fried Liver Attack Practice';
const PRACTICE_DESCRIPTION = 'A comprehensive practice tree for learning the Fried Liver Attack opening and its variations';
const PLAYER_COLOR: PlayerColor = 'WHITE';
const PRACTICE_TREE_FILE = path.join(process.cwd(), 'fried-liver-attack-practice.json');

// Type definition for practice tree nodes (matches frontend interface)
interface PracticeNodeInput {
    id: string;  // Temporary client-side ID
    fen: string;
    move: string | null;
    notes: string;
    lineNumber: number | null;
    children: PracticeNodeInput[];
}

async function main() {
    try {
        console.log('Starting practice tree import...');

        // Check if practice file exists
        if (!fs.existsSync(PRACTICE_TREE_FILE)) {
            throw new Error(`Practice tree file not found: ${PRACTICE_TREE_FILE}`);
        }

        // Read and parse the practice tree
        console.log(`Reading practice tree from: ${PRACTICE_TREE_FILE}`);
        const treeData = fs.readFileSync(PRACTICE_TREE_FILE, 'utf-8');
        const tree: PracticeNodeInput = JSON.parse(treeData);

        // Create the practice record
        console.log('Creating practice record...');
        const practice = await prisma.practice.create({
            data: {
                name: PRACTICE_NAME,
                description: PRACTICE_DESCRIPTION,
                playerColor: PLAYER_COLOR,
                createdBy: USER_ID,
            },
        });

        console.log(`Practice created with ID: ${practice.id}`);

        // Recursive function to create nodes
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
            });

            console.log(`Created node: ${node.id} (${createdNode.id})`);

            // Create children
            for (let i = 0; i < node.children.length; i++) {
                await createNodes(node.children[i], createdNode.id, i);
            }
        }

        // Start creating nodes from root
        console.log('Creating practice nodes...');
        await createNodes(tree, null, 0);

        console.log('Practice tree import completed successfully!');
        console.log(`Practice: ${PRACTICE_NAME}`);
        console.log(`Nodes created: ${countNodes(tree)}`);
    } catch (error) {
        console.error('Error importing practice tree:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Helper function to count total nodes in tree
function countNodes(node: PracticeNodeInput): number {
    let count = 1;
    for (const child of node.children) {
        count += countNodes(child);
    }
    return count;
}

main();
