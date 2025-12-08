import { PrismaClient, PlayerColor } from '@prisma/client';
import { Chess } from 'chess.js';

const prisma = new PrismaClient();

interface TreeNode {
    id: string;
    fen: string;
    move: string | null;
    notes: string;
    children: TreeNode[];
}

// Helper to generate unique IDs
let idCounter = 0;
function generateId(): string {
    return `temp_${idCounter++}`;
}

// Helper to build a line from PGN moves
function buildLineFromMoves(moves: string[], lineName: string): TreeNode[] {
    const chess = new Chess();
    const nodes: TreeNode[] = [];

    for (const move of moves) {
        try {
            chess.move(move);
            nodes.push({
                id: generateId(),
                fen: chess.fen(),
                move: chess.history({ verbose: true }).slice(-1)[0].lan,
                notes: '',
                children: []
            });
        } catch (error) {
            console.error(`Error making move ${move} in line ${lineName}:`, error);
            throw error;
        }
    }

    return nodes;
}

// Helper to merge a line into the tree
function mergeLineIntoTree(root: TreeNode, lineNodes: TreeNode[], lineName: string): void {
    let currentNode = root;

    for (let i = 0; i < lineNodes.length; i++) {
        const lineNode = lineNodes[i];

        // Check if this move already exists in children
        const existingChild = currentNode.children.find(child => child.fen === lineNode.fen);

        if (existingChild) {
            // Move already exists, continue down this path
            currentNode = existingChild;
        } else {
            // New variation, add it
            currentNode.children.push(lineNode);
            currentNode = lineNode;

            // Add remaining nodes
            for (let j = i + 1; j < lineNodes.length; j++) {
                currentNode.children.push(lineNodes[j]);
                currentNode = lineNodes[j];
            }
            break;
        }
    }
}

async function createViennaGambit2() {
    // Find the user "roshavi4ak"
    const coach = await prisma.user.findFirst({
        where: {
            OR: [
                { name: 'roshavi4ak' },
                { lichessId: 'roshavi4ak' }
            ]
        }
    });

    if (!coach) {
        console.error('Coach "roshavi4ak" not found in database');
        console.log('Please create this user first or update the script with the correct username');
        return;
    }

    console.log(`Found coach: ${coach.name} (${coach.id})`);

    // Define all 14 lines from the screenshots
    const lines = [
        {
            name: "Trappy Line",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Nh5", "Qxh5"]
        },
        {
            name: "Royal Fork",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Qe7", "Qe2", "Ng8", "Nf3", "d6", "Nd5", "Qe6", "Nxc7+"]
        },
        {
            name: "Queen Discovered!!",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Qe7", "Qe2", "Ng8", "Nf3", "d6", "Nd5", "Qd7", "Nxc7+", "Qxc7", "exd6+", "Qe7", "dxe7"]
        },
        {
            name: "Knight Retreats",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "Nc6", "fxe5", "Nxe5", "d4", "Ng6", "e5", "Ng8", "Nf3"]
        },
        {
            name: "Popular Line",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Ng8", "Nf3", "Nc6", "d4", "d6", "Bxf4", "dxe5", "Nxe5", "Nxe5", "Bxe5"]
        },
        {
            name: "Pawn Frozen",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Ng8", "Nf3", "d6", "d4", "dxe5", "Qe2", "Nc6", "Bxf4"]
        },
        {
            name: "Queen Re-Discovered",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Qe7", "Qe2", "Ng8", "Nf3", "Nc6", "d4", "d6", "Nd5", "Qd8", "Nxc7+", "Qxc7", "exd6+", "Be7", "dxc7"]
        },
        {
            name: "Material Sacrifice",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Ng8", "Nf3", "g5", "d4", "g4", "Bxf4", "gxf3", "Qxf3", "d6", "Bb5+", "c6", "O-O", "cxb5", "Bg5"]
        },
        {
            name: "Developed Pieces",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Ng8", "Nf3", "d6", "d4", "dxe5", "Qe2", "Bb4", "Qxe5+", "Qe7", "Bxf4"]
        },
        {
            name: "Bishop Blockade",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Ng8", "Nf3", "d6", "d4", "dxe5", "Qe2", "Be7", "Qxe5", "Nc6", "Bb5", "Bd7", "Bxc6", "Bxc6", "d5", "Bd7", "Bxf4"]
        },
        {
            name: "Center Space",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d6", "Nf3", "exf4", "d4"]
        },
        {
            name: "Knight Pinned",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d6", "Nf3", "Nc6", "Bb5"]
        },
        {
            name: "Main Line",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Qf3", "Nxc3", "bxc3", "Be7", "d4", "O-O", "Bd3", "Be6", "Ne2"]
        },
        {
            name: "Easy Position",
            moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Ng8", "Nf3", "d6", "d4", "dxe5", "Qe2", "Be7", "Qxe5", "Nf6", "Bxf4"]
        }
    ];

    // Create root node (starting position)
    const root: TreeNode = {
        id: generateId(),
        fen: new Chess().fen(),
        move: null,
        notes: 'Vienna Gambit 2 - Opening Practice',
        children: []
    };

    // Build the tree by merging all lines
    console.log('\nBuilding tree structure...');
    for (const line of lines) {
        console.log(`Processing: ${line.name}`);
        try {
            const lineNodes = buildLineFromMoves(line.moves, line.name);
            mergeLineIntoTree(root, lineNodes, line.name);
        } catch (error) {
            console.error(`Failed to process line: ${line.name}`);
            throw error;
        }
    }

    console.log('\nTree structure built successfully!');
    console.log(`Total variations: ${lines.length}`);

    // Create the practice in the database
    console.log('\nCreating practice in database...');

    const practice = await prisma.practice.create({
        data: {
            name: 'Vienna Gambit 2',
            description: 'Comprehensive Vienna Gambit practice with 14 different lines and variations',
            playerColor: PlayerColor.WHITE,
            createdBy: coach.id,
        },
    });

    console.log(`Practice created with ID: ${practice.id}`);

    // Recursively create nodes
    async function createNodes(node: TreeNode, parentId: string | null, order: number): Promise<void> {
        const createdNode = await prisma.practiceNode.create({
            data: {
                practiceId: practice.id,
                parentId,
                fen: node.fen,
                move: node.move,
                notes: node.notes || null,
                order,
            },
        });

        // Create children
        for (let i = 0; i < node.children.length; i++) {
            await createNodes(node.children[i], createdNode.id, i);
        }
    }

    await createNodes(root, null, 0);

    console.log('\n✅ Vienna Gambit 2 practice created successfully!');
    console.log(`Practice ID: ${practice.id}`);
    console.log(`Coach: ${coach.name}`);
    console.log(`Total lines: ${lines.length}`);
    console.log('\nYou can now edit it to add coach notes on each move.');
}

// Run the script
createViennaGambit2()
    .then(() => {
        console.log('\n✨ Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error creating practice:', error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
