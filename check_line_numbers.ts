
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLineNumbers() {
    const practiceId = "cmixqeggi0001v8fgg83pi4on";
    const nodes = await prisma.practiceNode.findMany({
        where: { practiceId, lineNumber: { not: null } }
    });
    console.log(`Found ${nodes.length} nodes with lineNumber set in Vienna Gambit.`);
    nodes.forEach(n => console.log(`- Node ${n.id}: lineNumber ${n.lineNumber}, move ${n.move}`));
}

checkLineNumbers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
