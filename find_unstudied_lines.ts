import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const username = "roshavi4ak";
    const practiceName = "Vienna Gambit";

    // 1. Find user
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { name: username },
                { lichessId: username }
            ]
        }
    });

    if (!user) {
        console.log("User not found.");
        return;
    }

    // 2. Find practice and its tree
    const practice = await prisma.practice.findFirst({
        where: { name: practiceName },
        include: {
            nodes: true
        }
    });

    if (!practice) {
        console.log("Practice not found.");
        return;
    }

    // 3. Reconstruct tree structure and find all lines
    const nodes = practice.nodes;
    const root = nodes.find(n => n.parentId === null);

    if (!root) {
        console.log("Root node not found.");
        return;
    }

    function getAllLines(nodeId: string, currentPath: any[] = []): any[][] {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return [];

        const path = [...currentPath, node];
        const children = nodes.filter(n => n.parentId === node.id);

        if (children.length === 0) {
            return [path];
        }

        const lines: any[][] = [];
        for (const child of children) {
            lines.push(...getAllLines(child.id, path));
        }
        return lines;
    }

    const allLines = getAllLines(root.id);

    // 4. Get studied lines
    const progress = await prisma.practiceLineProgress.findMany({
        where: {
            userId: user.id,
            practiceId: practice.id
        }
    });

    const studiedSignatures = new Set(progress.map(p => p.lineSignature));

    // 5. identify unstudied lines
    const unstudiedLines = allLines.filter(line => {
        const signature = line.map(n => n.id).join(",");
        return !studiedSignatures.has(signature);
    });

    console.log(`Summary for ${username} on "${practiceName}":`);
    console.log(`Total lines: ${allLines.length}`);
    console.log(`Studied lines: ${allLines.length - unstudiedLines.length}`);
    console.log(`Unstudied lines: ${unstudiedLines.length}`);
    console.log("\n--- UNSTUDIED LINES ---");

    unstudiedLines.forEach((line, index) => {
        const moves = line.map(n => n.move).filter(Boolean);
        console.log(`${index + 1}. ${moves.join(" → ")}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
