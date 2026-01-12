import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const usernames = ["roshavi4ak", "mi666ka"];

    // 1. Find the users
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { in: usernames } },
                { lichessId: { in: usernames } }
            ]
        }
    });

    if (users.length === 0) {
        console.log("No users found with these names.");
        return;
    }

    // 2. Fetch progress
    const progress = await prisma.practiceLineProgress.findMany({
        where: {
            userId: { in: users.map(u => u.id) }
        },
        include: {
            user: true,
            practice: {
                include: {
                    nodes: true
                }
            }
        }
    });

    if (progress.length === 0) {
        console.log("No progress found for these users.");
        return;
    }

    // Function to reconstruct move line from signature
    const getMoveLine = (practice: any, signature: string) => {
        const nodeIds = signature.split(",");
        const moves: string[] = [];
        nodeIds.forEach(id => {
            const node = practice.nodes.find((n: any) => n.id === id);
            if (node && node.move) {
                moves.push(node.move);
            }
        });
        return moves.join(" -> ");
    };

    const tableData = progress.map(p => ({
        User: p.user.name || p.user.lichessId,
        Practice: p.practice.name,
        Line: getMoveLine(p.practice, p.lineSignature),
        Status: p.status,
        Attempts: p.attempts,
        Perfect: p.perfectCount
    }));

    process.stdout.write(JSON.stringify(tableData, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
