import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Find the practice
        const practices = await prisma.practice.findMany({
            where: { name: { contains: 'Vienna' } }
        });
        console.log('Practices:', practices.map(p => ({ name: p.name, id: p.id })));

        const practice = practices[0];
        if (!practice) {
            console.log('Practice not found');
            return;
        }
        console.log('Practice:', practice.name, 'ID:', practice.id);

        // Find the user
        const user = await prisma.user.findFirst({
            where: { name: 'roshavi4ak' }
        });
        if (!user) {
            console.log('User not found');
            return;
        }
        console.log('User:', user.name, 'ID:', user.id);

        // Get progress
        const progress = await prisma.practiceLineProgress.findMany({
            where: {
                practiceId: practice.id,
                userId: user.id
            }
        });

        console.log('Total progress entries:', progress.length);

        const statusCounts = progress.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('Status counts:', statusCounts);

        // Get all leaf nodes
        const allNodes = await prisma.practiceNode.findMany({
            where: { practiceId: practice.id },
            include: { children: true }
        });

        function getLeafNodes(nodes: any[], parentId: string | null = null): any[] {
            const children = nodes.filter(n => n.parentId === parentId);
            const leaves: any[] = [];
            for (const child of children) {
                const childChildren = nodes.filter(n => n.parentId === child.id);
                if (childChildren.length === 0) {
                    leaves.push(child);
                } else {
                    leaves.push(...getLeafNodes(nodes, child.id));
                }
            }
            return leaves;
        }

        const leafNodes = getLeafNodes(allNodes);
        console.log('Total leaf nodes:', leafNodes.length);

        const neverSeen = leafNodes.length - progress.length;
        console.log('Never seen:', neverSeen);

        console.log('Detailed status:');
        progress.forEach(p => {
            console.log(`Node ${p.nodeId}: ${p.status}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();