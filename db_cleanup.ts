
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function thoroughCleanup() {
    const username = "roshavi4ak";
    const user = await prisma.user.findFirst({ where: { name: username } });

    if (!user) {
        console.log("User not found");
        return;
    }

    console.log("Found user ID:", user.id);

    const practices = await prisma.practice.findMany({
        where: { createdBy: user.id },
        include: { nodes: true }
    });

    for (const practice of practices) {
        console.log(`\nProcessing Practice: ${practice.name} (ID: ${practice.id})`);

        // Identify current leaf nodes
        const leafNodeIds = new Set(
            practice.nodes
                .filter(n => !practice.nodes.some(child => child.parentId === n.id))
                .map(n => n.id)
        );
        console.log(`- Current tree has ${leafNodeIds.size} leaf nodes.`);

        const progressRecords = await prisma.practiceLineProgress.findMany({
            where: { userId: user.id, practiceId: practice.id }
        });
        console.log(`- User has ${progressRecords.length} progress records.`);

        const toDelete = [];
        const seenLeafIds = new Set();

        for (const record of progressRecords) {
            if (!leafNodeIds.has(record.nodeId)) {
                console.log(`- record for nodeId ${record.nodeId} is NO LONGER a leaf node. Deleting.`);
                toDelete.push(record.id);
            } else if (seenLeafIds.has(record.nodeId)) {
                console.log(`- duplicate record for nodeId ${record.nodeId}. Deleting.`);
                toDelete.push(record.id);
            } else {
                seenLeafIds.add(record.nodeId);
            }
        }

        if (toDelete.length > 0) {
            await prisma.practiceLineProgress.deleteMany({
                where: { id: { in: toDelete } }
            });
            console.log(`- Cleaned up ${toDelete.length} records.`);
        } else {
            console.log("- No cleanup needed.");
        }
    }
}

thoroughCleanup()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
