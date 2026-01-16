
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findNodePath(nodeId: string) {
    const nodes = await prisma.practiceNode.findMany({
        where: {
            practice: {
                nodes: {
                    some: { id: nodeId }
                }
            }
        },
        orderBy: { order: 'asc' }
    });

    if (nodes.length === 0) {
        console.log("Node not found");
        return;
    }

    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));

    let current = nodeMap.get(nodeId);
    const path = [];
    while (current) {
        path.unshift(current);
        current = nodeMap.get(current.parentId);
    }

    console.log("Move Path for node:", nodeId);
    path.forEach((node, index) => {
        console.log(`${index}: ID: ${node.id}, Move: ${node.move}, FEN: ${node.fen}`);
    });
}

findNodePath("cmkh6176k000jv8j48lskrcyg")
    .catch(console.error)
    .finally(() => prisma.$disconnect());
