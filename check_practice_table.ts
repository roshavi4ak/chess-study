import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const usernames = ["roshavi4ak", "mi666ka"];

    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { in: usernames } },
                { lichessId: { in: usernames } }
            ]
        }
    });

    if (users.length === 0) {
        console.log("No users found.");
        return;
    }

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

    // Helper to get moves
    const getMoves = (nodes: any[], signature: string) => {
        const ids = signature.split(",");
        const moves: string[] = [];
        for (const id of ids) {
            const node = nodes.find(n => n.id === id);
            if (node && node.move) {
                moves.push(node.move);
            }
        }
        return moves;
    };

    console.log("| User | Practice | Line (Moves) | Status | Attempts | Perfect |");
    console.log("| :--- | :--- | :--- | :--- | :--- | :--- |");

    const sortedProgress = progress.sort((a, b) => {
        const userA = a.user.name || a.user.lichessId || "";
        const userB = b.user.name || b.user.lichessId || "";
        const userDiff = userA.localeCompare(userB);
        if (userDiff !== 0) return userDiff;
        return a.practice.name.localeCompare(b.practice.name);
    });

    sortedProgress.forEach(p => {
        const moves = getMoves(p.practice.nodes, p.lineSignature);
        const lineStr = moves.length > 0 ? moves.join(" → ") : "(Start position only or moves missing)";
        const userName = p.user.name || p.user.lichessId || "Unknown";
        console.log(`| ${userName} | ${p.practice.name} | ${lineStr} | ${p.status} | ${p.attempts} | ${p.perfectCount} |`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
